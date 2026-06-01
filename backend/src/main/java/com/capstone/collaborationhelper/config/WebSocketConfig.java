package com.capstone.collaborationhelper.config;

import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final CrdtWebSocketHandler crdtWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // 클라이언트에서 ws://[서버주소]/ws/crdt/{projectId} 형태로 접근하도록 허용
        registry.addHandler(crdtWebSocketHandler, "/ws/crdt/*")
                .setAllowedOrigins("*");
    }
}