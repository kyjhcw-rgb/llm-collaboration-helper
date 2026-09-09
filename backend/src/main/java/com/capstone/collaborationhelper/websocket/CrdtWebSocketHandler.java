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
    public record VersionCreatedEvent(Integer projectId) {}
    public record MentionEvent(Integer projectId, Integer targetUserId, String senderNickname) {}

    // 다이어그램 업데이트 이벤트 (수정 제안 수락 등)
    public record DiagramUpdatedEvent(Integer projectId, Integer senderId) {}

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
        session.getAttributes().put("nickname", user.getNickname());
        if (user.getProfileImageUrl() != null) {
            session.getAttributes().put("profileImageUrl", user.getProfileImageUrl());
        }

        projectSessions.computeIfAbsent(projectId, k -> new CopyOnWriteArrayList<>()).add(session);
        log.info("웹소켓 연결 성공: 프로젝트 ID = {}, 유저 이메일 = {}", projectId, username);

        // 누군가 접속하면 온라인 유저 목록 브로드캐스트
        broadcastOnlineUsers(projectId);
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
            CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);

            // 단순 객체 비교(remove) 대신 세션 ID로 확실하게 찾아 제거
            sessions.removeIf(s -> s.getId().equals(session.getId()));

            if (sessions.isEmpty()) {
                projectSessions.remove(projectId);
            } else {
                // 누군가 퇴장하면 남은 사람들에게 갱신된 온라인 유저 목록 브로드캐스트
                broadcastOnlineUsers(projectId);

                // 유저 접속이 완전히 끊겼을 때 (다른 탭 포함) 하이라이트 지우기
                Integer userId = (Integer) session.getAttributes().get("userId");
                if (userId != null) {
                    boolean isUserStillOnline = sessions.stream()
                            .anyMatch(s -> s.isOpen() && userId.equals(s.getAttributes().get("userId")));

                    if (!isUserStillOnline) {
                        broadcastPresenceClear(projectId, userId);
                    }
                }
            }
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

    // 다이어그램 업데이트 이벤트 (제안 수락 시 발행되어 다른 클라이언트들을 갱신시킴)
    @EventListener
    public void handleDiagramUpdatedEvent(DiagramUpdatedEvent event) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(event.projectId());
        if (sessions != null) {
            TextMessage textMsg = new TextMessage("{\"type\": \"DIAGRAM_UPDATED\"}");
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    // 수락(적용)한 발신자 본인은 제외합니다 (본인 화면은 이미 갱신 절차를 수행 중)
                    if (!event.senderId().equals(s.getAttributes().get("userId"))) {
                        synchronized (s) { try { s.sendMessage(textMsg); } catch (Exception e) {} }
                    }
                }
            }
        }
    }

    // 방장이 버전을 저장했을 때 접속 중인 팀원들에게 쏘는 이벤트 핸들러
    @EventListener
    public void handleVersionCreatedEvent(VersionCreatedEvent event) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(event.projectId());
        if (sessions != null) {
            TextMessage textMsg = new TextMessage("{\"type\": \"VERSION_CREATED\"}");
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    synchronized (s) { try { s.sendMessage(textMsg); } catch (Exception e) {} }
                }
            }
        }
    }

    @EventListener
    public void handleMentionEvent(MentionEvent event) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(event.projectId());
        if (sessions != null) {
            // 전달할 JSON 메시지 포맷 구성
            TextMessage textMsg = new TextMessage(String.format("{\"type\": \"MENTIONED\", \"senderNickname\": \"%s\"}", event.senderNickname()));

            for (WebSocketSession s : sessions) {
                // 멘션 대상자의 세션을 찾아 메시지 전송
                if (s.isOpen() && event.targetUserId().equals(s.getAttributes().get("userId"))) {
                    synchronized (s) {
                        try { s.sendMessage(textMsg); } catch (Exception e) { log.error("멘션 실시간 알림 전송 실패", e); }
                    }
                }
            }
        }
    }

    private void broadcastOnlineUsers(Integer projectId) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions == null) return;

        // 중복 접속자(같은 유저가 여러 탭 띄운 경우) 방지를 위한 Set
        java.util.Set<Integer> onlineUserIds = new java.util.HashSet<>();
        java.util.List<java.util.Map<String, Object>> onlineUsers = new java.util.ArrayList<>();

        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                Integer userId = (Integer) s.getAttributes().get("userId");
                if (userId != null && !onlineUserIds.contains(userId)) {
                    onlineUserIds.add(userId);
                    java.util.Map<String, Object> userMap = new java.util.HashMap<>();
                    userMap.put("userId", userId);
                    userMap.put("nickname", s.getAttributes().get("nickname"));
                    userMap.put("profileImageUrl", s.getAttributes().get("profileImageUrl"));
                    onlineUsers.add(userMap);
                }
            }
        }

        try {
            java.util.Map<String, Object> message = new java.util.HashMap<>();
            message.put("type", "ONLINE_USERS");
            message.put("users", onlineUsers);
            TextMessage textMsg = new TextMessage(objectMapper.writeValueAsString(message));

            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    synchronized (s) {
                        try { s.sendMessage(textMsg); } catch (Exception e) {}
                    }
                }
            }
        } catch (Exception e) {
            log.error("온라인 유저 브로드캐스트 실패", e);
        }
    }

    // 유저가 오프라인이 될 때 선택을 지워주는 빈 브로드캐스트
    private void broadcastPresenceClear(Integer projectId, Integer userId) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions == null) return;

        try {
            java.util.Map<String, Object> message = new java.util.HashMap<>();
            message.put("type", "PRESENCE_UPDATE");
            message.put("userId", userId);
            message.put("selectedNodeIds", new java.util.ArrayList<>());

            TextMessage textMsg = new TextMessage(objectMapper.writeValueAsString(message));
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    synchronized (s) {
                        try { s.sendMessage(textMsg); } catch (Exception e) {}
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to broadcast presence clear", e);
        }
    }
}