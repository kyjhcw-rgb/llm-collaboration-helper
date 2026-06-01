package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.AuthDtos.UserUpdateReq;
import com.capstone.collaborationhelper.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;

    // 내 계정 정보 수정 API
    @PutMapping("/me")
    public ResponseEntity<?> updateMyInfo(Principal principal, @RequestBody UserUpdateReq req) {

        // JWT 토큰이 없거나 유효하지 않은 경우 접근 차단
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요한 서비스입니다."));
        }

        try {
            // SecurityContext에 저장된 유저명(username)을 넘겨서 정보 수정
            authService.updateUserInfo(principal.getName(), req);
            return ResponseEntity.ok(Map.of("message", "계정 정보가 성공적으로 수정되었습니다."));

        } catch (IllegalArgumentException e) {
            // 비밀번호가 틀린 경우 등 예외 처리 (400 상태 코드)
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "서버 오류가 발생했습니다."));
        }
    }
}