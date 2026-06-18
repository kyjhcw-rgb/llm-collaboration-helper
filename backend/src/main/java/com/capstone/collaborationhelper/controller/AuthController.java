package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.AuthDtos.*;
import com.capstone.collaborationhelper.service.AuthService;
import com.capstone.collaborationhelper.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final EmailService emailService;

    // 1. 인증 메일 발송
    @PostMapping("/email/send")
    public ResponseEntity<?> sendEmail(@RequestBody EmailSendReq req) {
        emailService.sendVerificationEmail(req.getEmail());
        return ResponseEntity.ok(Map.of("message", "인증 메일이 발송되었습니다."));
    }

    // 2. 인증 번호 확인
    @PostMapping("/email/verify")
    public ResponseEntity<?> verifyEmail(@RequestBody EmailVerifyReq req) {
        emailService.verifyCode(req.getEmail(), req.getCode());
        return ResponseEntity.ok(Map.of("message", "이메일 인증이 완료되었습니다."));
    }

    // 3. 회원가입 (모든 정보 입력 완료 후)
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody SignupReq req) {
        authService.signup(req);
        return ResponseEntity.ok(Map.of("message", "회원가입 성공"));
    }

    // 4. 로그인
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginReq req) {
        String token = authService.login(req);
        return ResponseEntity.ok(Map.of("accessToken", token));
    }

    // 아이디 중복 검사 API
    @GetMapping("/check-username")
    public ResponseEntity<?> checkUsername(@RequestParam String username) {
        boolean isAvailable = authService.isUsernameAvailable(username);
        return ResponseEntity.ok(Map.of("available", isAvailable));
    }

    // 이메일 중복 검사 API
    @GetMapping("/check-email")
    public ResponseEntity<?> checkEmail(@RequestParam String email) {
        boolean isAvailable = authService.isEmailAvailable(email);
        return ResponseEntity.ok(Map.of("available", isAvailable));
    }
}