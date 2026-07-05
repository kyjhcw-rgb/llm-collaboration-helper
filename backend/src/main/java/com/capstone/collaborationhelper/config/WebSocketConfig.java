package com.capstone.collaborationhelper.config;

import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final CrdtWebSocketHandler crdtWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // 클라이언트에서 ws://[서버주소]/ws/crdt/{projectId} 형태로 접근하도록 허용
        registry.addHandler(crdtWebSocketHandler, "/ws/crdt/*")
                .setAllowedOrigins("*");    // 모든 도메인 허용 (운영 환경에서는 실제 프론트 도메인으로 변경)
    }

    // Spring Boot의 웹소켓 기본 버퍼 한계(8KB)를 1MB로 해제하여 CRDT 패킷 끊김 방지
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(1024 * 1024);   // 1MB
        container.setMaxBinaryMessageBufferSize(1024 * 1024); // 1MB
        return container;
    }
}