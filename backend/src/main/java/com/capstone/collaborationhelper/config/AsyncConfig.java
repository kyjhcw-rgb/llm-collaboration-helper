package com.capstone.collaborationhelper.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync // Spring의 @Async 기능을 엔진 수준에서 활성화
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);       // 기본 스레드 수
        executor.setMaxPoolSize(30);        // 동시 요청 폭주 시 최대 스레드 수
        executor.setQueueCapacity(200);     // 대기 큐 크기
        executor.setThreadNamePrefix("AI-Async-");
        executor.initialize();
        return executor;
    }
}