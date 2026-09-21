package com.capstone.collaborationhelper;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync; // 추가
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableAsync      // @Async 백그라운드 스레드 풀 가동을 위해 필수 추가
@EnableScheduling // 3초 주기의 인메모리 버퍼링 스케줄러
@SpringBootApplication
public class CollaborationHelperApplication {

    public static void main(String[] args) {
        SpringApplication.run(CollaborationHelperApplication.class, args);
    }

}