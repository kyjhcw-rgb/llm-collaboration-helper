package com.capstone.collaborationhelper;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling // 3초 주기의 인메모리 버퍼링 스케줄러를 위해 추가
@SpringBootApplication
public class CollaborationHelperApplication {

	public static void main(String[] args) {
		SpringApplication.run(CollaborationHelperApplication.class, args);
	}

}
