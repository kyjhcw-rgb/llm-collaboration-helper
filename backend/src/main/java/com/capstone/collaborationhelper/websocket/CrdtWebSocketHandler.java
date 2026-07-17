package com.capstone.collaborationhelper.websocket;

import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.PartyRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import com.capstone.collaborationhelper.security.JwtTokenProvider;
import com.capstone.collaborationhelper.service.CrdtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.net.URI;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Component
@RequiredArgsConstructor
public class CrdtWebSocketHandler extends AbstractWebSocketHandler {

    private final CrdtService crdtService;
    private final JwtTokenProvider jwtTokenProvider;
    private final PartyRepository partyRepository;
    private final UserRepository userRepository; // Username 조회를 위한 의존성 주입
    private final ObjectMapper objectMapper;

    private final Map<Integer, CopyOnWriteArrayList<WebSocketSession>> projectSessions = new ConcurrentHashMap<>();

    // 서비스 로직과의 분리를 위한 이벤트 레코드 정의
    public record RoleChangeEvent(Integer projectId, Integer userId, String newRole) {}
    public record KickUserEvent(Integer projectId, Integer userId) {}
    public record ForceReloadEvent(Integer projectId) {}

    // --- 웹소켓 생명주기 및 CRDT 브로드캐스트 로직 ---

    private Integer extractProjectId(WebSocketSession session) {
        return Integer.parseInt(session.getUri().getPath().substring(session.getUri().getPath().lastIndexOf('/') + 1));
    }

    private String extractToken(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri != null && uri.getQuery() != null) {
            for (String param : uri.getQuery().split("&")) {
                if (param.startsWith("token=")) return param.substring(6);
            }
        }
        return null;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Integer projectId = extractProjectId(session);
        String token = extractToken(session);

        if (token == null || !jwtTokenProvider.validateToken(token)) {
            log.warn("인증 실패: 유효하지 않은 웹소켓 토큰");
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid Token"));
            return;
        }

        String username = jwtTokenProvider.getUsername(token);
        User user = userRepository.findByUsername(username).orElse(null);

        if (user == null) {
            log.warn("웹소켓 연결 거부: 존재하지 않는 유저 ({})", username);
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("User Not Found"));
            return;
        }

        // 이메일 조회가 아닌 UserId 기반의 안전한 파티원 조회로 변경
        Party party = partyRepository.findByProjectIdAndUserId(projectId, user.getId()).orElse(null);

        if (party == null) {
            log.warn("웹소켓 연결 거부: Party 권한 없음 ({})", username);
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("No Access Rights"));
            return;
        }

        // 세션 속성 저장 시 실제 유저의 진짜 이메일과, 토큰에서 뽑은 username을 명확하게 분리해서 저장
        session.getAttributes().put("email", user.getEmail());
        session.getAttributes().put("username", username);
        session.getAttributes().put("userId", party.getUser().getId());
        session.getAttributes().put("role", party.getRole());

        projectSessions.computeIfAbsent(projectId, k -> new CopyOnWriteArrayList<>()).add(session);
        log.info("웹소켓 연결 성공: 프로젝트 ID = {}, 유저 이메일 = {}", projectId, username);
    }

    // Yjs 바이너리 데이터 수신 시 (실시간 동시 편집)
    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        Integer userId = (Integer) session.getAttributes().get("userId");
        String role = (String) session.getAttributes().get("role");

        // 권한이 없어서 쫓겨나는 중인 유저(userId가 셋팅 안됨)나 GUEST의 데이터는 즉시 무시
        if (userId == null || "GUEST".equalsIgnoreCase(role)) return;

        Integer projectId = extractProjectId(session);
        ByteBuffer payload = message.getPayload();
        byte[] updateData = new byte[payload.remaining()];
        payload.get(updateData);

        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions != null) {
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && !s.getId().equals(session.getId())) {
                    synchronized (s) { try { s.sendMessage(new BinaryMessage(updateData)); } catch (Exception e) {} }
                }
            }
        }
        crdtService.bufferCrdtLog(projectId, userId, updateData);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Integer userId = (Integer) session.getAttributes().get("userId");
        // 비정상 세션 텍스트 명령어 무시
        if (userId == null) return;

        Integer projectId = extractProjectId(session);

        // 프론트엔드의 상태 동기화 요청(REQUEST_SYNC) 완벽 대응
        try {
            JsonNode json = objectMapper.readTree(message.getPayload());
            if (json.has("type") && "REQUEST_SYNC".equals(json.get("type").asText())) {
                // 백엔드가 쥐고 있는 스냅샷+로그들을 한 팩으로 묶어서 요청한 클라이언트에게만 응답
                Map<String, Object> syncState = crdtService.getFullSyncState(projectId);
                synchronized (session) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(syncState)));
                }
                log.info("클라이언트에게 Yjs 통합 상태(SYNC_STATE)를 전송했습니다. (프로젝트 ID: {})", projectId);
                return;
            }
        } catch (Exception e) {
            // JSON 파싱 에러나 일반 텍스트면 그냥 무시하고 브로드캐스트로 넘김
        }

        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions != null) {
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && !s.getId().equals(session.getId())) {
                    synchronized (s) { try { s.sendMessage(new TextMessage(message.getPayload())); } catch (Exception e) {} }
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        Integer projectId = extractProjectId(session);
        if (projectSessions.containsKey(projectId)) {
            projectSessions.get(projectId).remove(session);
            if (projectSessions.get(projectId).isEmpty()) projectSessions.remove(projectId);
        }
    }

    // --- 스프링 이벤트 리스너 (서비스 레이어에서 호출 시 반응) ---

    @EventListener
    public void handleRoleChangeEvent(RoleChangeEvent event) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(event.projectId());
        if (sessions != null) {
            TextMessage textMsg = new TextMessage(String.format("{\"type\": \"ROLE_UPDATED\", \"userId\": %d, \"newRole\": \"%s\"}", event.userId(), event.newRole()));
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    if (event.userId().equals(s.getAttributes().get("userId"))) {
                        s.getAttributes().put("role", event.newRole());
                    }
                    synchronized (s) { try { s.sendMessage(textMsg); } catch (Exception e) {} }
                }
            }
        }
    }

    @EventListener
    public void handleKickUserEvent(KickUserEvent event) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(event.projectId());
        if (sessions != null) {
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && event.userId().equals(s.getAttributes().get("userId"))) {
                    try {
                        synchronized (s) { s.sendMessage(new TextMessage("{\"type\": \"KICKED\"}")); }
                        s.close(CloseStatus.NORMAL.withReason("Kicked by OWNER"));
                    } catch (Exception e) {}
                }
            }
        }
    }

    @EventListener
    public void handleForceReloadEvent(ForceReloadEvent event) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(event.projectId());
        if (sessions != null) {
            TextMessage textMsg = new TextMessage("{\"type\": \"FORCE_RELOAD\"}");
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    synchronized (s) { try { s.sendMessage(textMsg); } catch (Exception e) {} }
                }
            }
        }
    }



    /*@Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // 프론트에서 넘어오는 Text 명령이 있다면 여기서 처리 (현재는 서버 -> 프론트 단방향 명령만 사용)
    }


    private void broadcastUpdate(Integer projectId, WebSocketSession senderSession, byte[] updateData) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions != null) {
            BinaryMessage msgToSend = new BinaryMessage(updateData);
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && !s.getId().equals(senderSession.getId())) {
                    try {
                        synchronized (s) { s.sendMessage(msgToSend); }
                    } catch (IOException e) {
                        log.error("바이너리 브로드캐스트 에러: {}", e.getMessage());
                    }
                }
            }
        }
    }

    // 방장이 라이브를 복원했을 때, 다른 모든 팀원들의 화면을 강제로 새로고침시키는 Text 커맨드
    public void broadcastCommand(Integer projectId, String command) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions != null) {
            TextMessage textMsg = new TextMessage(command);
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    try {
                        synchronized (s) { s.sendMessage(textMsg); }
                    } catch (IOException e) {
                        log.error("명령 브로드캐스트 에러: {}", e.getMessage());
                    }
                }
            }
        }
    }

    // 방장이 팀원의 권한을 변경했을 때, 타겟 유저의 백엔드 세션을 즉시 조작하고 프론트에 알림
    public void updateSessionRole(Integer projectId, Integer targetUserId, String newRole) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions != null) {
            String payload = String.format("{\"type\": \"ROLE_UPDATED\", \"userId\": %d, \"newRole\": \"%s\"}", targetUserId, newRole);
            TextMessage textMsg = new TextMessage(payload);
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    try {
                        // 세션 주인이 타겟 유저라면 백엔드의 세션 권한을 강제 업데이트
                        if (targetUserId.equals(s.getAttributes().get("userId"))) {
                            s.getAttributes().put("role", newRole);
                        }
                        // 모든 클라이언트에게 권한 변경 이벤트 전송
                        synchronized (s) { s.sendMessage(textMsg); }
                    } catch (IOException e) {}
                }
            }
        }
    }

    // 방장이 멤버를 강퇴했을 때, 해당 유저의 웹소켓 연결 강제 종료
    public void disconnectUser(Integer projectId, Integer targetUserId) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions != null) {
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && targetUserId.equals(s.getAttributes().get("userId"))) {
                    try {
                        String payload = "{\"type\": \"KICKED\"}";
                        synchronized (s) { s.sendMessage(new TextMessage(payload)); }
                        s.close(CloseStatus.NORMAL.withReason("Kicked by OWNER"));
                    } catch (IOException e) {}
                }
            }
        }
    }*/
}