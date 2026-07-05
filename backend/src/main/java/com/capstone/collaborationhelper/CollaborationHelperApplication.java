package com.capstone.collaborationhelper;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling // 백그라운드 동기화(Worker)를 위한 스케줄링 활성화
public class CollaborationHelperApplication {
	public static void main(String[] args) {
        SpringApplication.run(CollaborationHelperApplication.class, args);
	}

}
