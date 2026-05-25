package com.capstone.collaborationhelper.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppConfig {

    // CanvasService 등에서 JSON <-> Byte 변환 시 사용할 ObjectMapper 빈 등록
    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    // LlmClient에서 FastAPI(AI 서버)와 HTTP 통신을 할 때 사용할 RestTemplate 빈 등록
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}