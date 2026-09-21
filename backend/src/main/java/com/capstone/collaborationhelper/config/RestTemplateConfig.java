package com.capstone.collaborationhelper.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);   // AI 서버 연결 시도 타임아웃: 5초
        factory.setReadTimeout(120000);    // AI 응답 대기 타임아웃: 120초 (77초 대기 고려)
        return new RestTemplate(factory);
    }
}