package com.capstone.collaborationhelper.websocket;

import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.repository.PartyRepository;
import com.capstone.collaborationhelper.security.JwtTokenProvider;
import com.capstone.collaborationhelper.service.CrdtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Component
@RequiredArgsConstructor
public class CrdtWebSocketHandler extends BinaryWebSocketHandler {

    private final CrdtService crdtService;
    private final JwtTokenProvider jwtTokenProvider;
    private final PartyRepository partyRepository;

    private final Map<Integer, CopyOnWriteArrayList<WebSocketSession>> projectSessions = new ConcurrentHashMap<>();

    private Integer extractProjectId(WebSocketSession session) {
        String path = session.getUri().getPath();
        return Integer.parseInt(path.substring(path.lastIndexOf('/') + 1));
    }

    private String extractToken(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri != null && uri.getQuery() != null) {
            String[] queryParams = uri.getQuery().split("&");
            for (String param : queryParams) {
                if (param.startsWith("token=")) {
                    return param.substring(6);
                }
            }
        }
        return null;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Integer projectId = extractProjectId(session);
        String token = extractToken(session);

        if (token == null || !jwtTokenProvider.validateToken(token)) {
            log.warn("웹소켓 연결 차단: 유효하지 않은 토큰");
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid Token"));
            return;
        }

        String email = jwtTokenProvider.getEmail(token);

        // Party 테이블이 권한의 유일한 기준
        Party party = partyRepository.findByProject_IdAndUser_Email(projectId, email).orElse(null);

        if (party == null) {
            log.warn("웹소켓 연결 차단: Party 테이블에 등록되지 않은 유저 ({})", email);
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("No Access Rights"));
            return;
        }

        String role = party.getRole(); // OWNER, MEMBER, GUEST

        session.getAttributes().put("email", email);
        session.getAttributes().put("role", role);

        projectSessions.computeIfAbsent(projectId, k -> new CopyOnWriteArrayList<>()).add(session);
        log.info("웹소켓 연결됨: 프로젝트 ID = {}, 세션 ID = {}, 유저 = {}, 권한 = {}",
                projectId, session.getId(), email, role);
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        String role = (String) session.getAttributes().get("role");
        String email = (String) session.getAttributes().get("email"); // 추가: 세션에서 이메일 꺼내기

        if ("GUEST".equalsIgnoreCase(role)) {
            log.warn("Guest 유저({})의 다이어그램 수정 시도가 차단되었습니다.", email);
            return;
        }

        Integer projectId = extractProjectId(session);
        ByteBuffer payload = message.getPayload();
        byte[] updateData = new byte[payload.remaining()];
        payload.get(updateData);

        broadcastUpdate(projectId, session, updateData);

        // 누가 편집했는지 DB에 남기기 위해 email도 함께 넘김
        crdtService.saveCrdtLog(projectId, email, updateData);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        Integer projectId = extractProjectId(session);
        if (projectSessions.containsKey(projectId)) {
            projectSessions.get(projectId).remove(session);
            if (projectSessions.get(projectId).isEmpty()) {
                projectSessions.remove(projectId);
            }
        }
        log.info("웹소켓 종료됨: 세션 ID = {}", session.getId());
    }

    private void broadcastUpdate(Integer projectId, WebSocketSession senderSession, byte[] updateData) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions != null) {
            BinaryMessage msgToSend = new BinaryMessage(updateData);
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && !s.getId().equals(senderSession.getId())) {
                    try {
                        synchronized (s) {
                            s.sendMessage(msgToSend);
                        }
                    } catch (IOException e) {
                        log.error("메시지 브로드캐스트 실패: {}", e.getMessage());
                    }
                }
            }
        }
    }
}