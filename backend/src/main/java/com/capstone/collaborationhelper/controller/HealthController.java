package com.capstone.collaborationhelper.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "0. 서버 상태 확인", description = "서버가 잘 켜졌는지 확인하는 API")
@RestController
public class HealthController {

    // @Operation은 Swagger 문서에서 이 API가 어떤 역할을 하는지 설명해 줍니다.
    @Operation(summary = "서버 작동 확인", description = "서버가 정상적으로 실행 중인지 간단한 메시지로 확인합니다.")
    @GetMapping("/api/health")
    public ResponseEntity<String> checkHealth() {
        return ResponseEntity.ok("백엔드 서버가 정상적으로 작동 중입니다 :)");
    }
}