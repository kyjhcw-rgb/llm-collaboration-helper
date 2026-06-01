package com.capstone.collaborationhelper.websocket;

import com.capstone.collaborationhelper.service.CrdtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Component
@RequiredArgsConstructor
public class CrdtWebSocketHandler extends BinaryWebSocketHandler {

    private final CrdtService crdtService;

    // projectId를 Key로 하고, 해당 프로젝트에 연결된 WebSocketSession 리스트를 Value로 관리
    private final Map<Integer, CopyOnWriteArrayList<WebSocketSession>> projectSessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Integer projectId = extractProjectId(session);
        projectSessions.computeIfAbsent(projectId, k -> new CopyOnWriteArrayList<>()).add(session);
        log.info("동시 편집 WebSocket 연결됨: 세션 ID = {}, 프로젝트 ID = {}", session.getId(), projectId);
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        Integer projectId = extractProjectId(session);

        // 1. 수신한 Yjs(CRDT) 바이너리 업데이트 데이터 추출
        ByteBuffer payload = message.getPayload();
        byte[] updateData = new byte[payload.remaining()];
        payload.get(updateData);

        // 2. 같은 프로젝트 방에 있는 다른 유저들에게 실시간 브로드캐스트 (Echo)
        broadcastUpdate(projectId, session, message);

        // 3. 데이터베이스에 변경 조각 저장 (비동기로 처리하거나 큐를 도입하는 것을 추후 권장한다고 함)
        crdtService.saveCrdtLog(projectId, updateData);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        Integer projectId = extractProjectId(session);
        if (projectSessions.containsKey(projectId)) {
            projectSessions.get(projectId).remove(session);
            if (projectSessions.get(projectId).isEmpty()) {
                projectSessions.remove(projectId); // 방에 아무도 없으면 메모리 정리
            }
        }
        log.info("동시 편집 WebSocket 종료됨: 세션 ID = {}", session.getId());
    }

    // 발신자를 제외한 같은 방 사람들에게 메시지를 뿌려주는 메서드
    private void broadcastUpdate(Integer projectId, WebSocketSession senderSession, BinaryMessage message) {
        CopyOnWriteArrayList<WebSocketSession> sessions = projectSessions.get(projectId);
        if (sessions != null) {
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && !s.getId().equals(senderSession.getId())) {
                    try {
                        // Binary Message 전송
                        s.sendMessage(message);
                    } catch (IOException e) {
                        log.error("메시지 전송 실패: 세션 ID = {}", s.getId(), e);
                    }
                }
            }
        }
    }

    // URI에서 projectId 추출 (예: ws://localhost:8080/ws/crdt/123 -> 123)
    private Integer extractProjectId(WebSocketSession session) {
        String path = session.getUri().getPath();
        String[] segments = path.split("/");
        return Integer.parseInt(segments[segments.length - 1]);
    }
}