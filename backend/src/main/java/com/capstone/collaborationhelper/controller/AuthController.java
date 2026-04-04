package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.LoginRequest;
import com.capstone.collaborationhelper.dto.LoginResponse;
import com.capstone.collaborationhelper.dto.SignupRequest;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Authentication", description = "로그인 및 회원가입 API")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @Operation(summary = "회원가입", description = "이메일, 비밀번호, 이름을 받고 회원가입")
    @PostMapping("/signup")
    public ResponseEntity<String> signup(@Valid @RequestBody SignupRequest request) {
        authService.signup(request);
        return ResponseEntity.ok("회원가입 성공");
    }

    @Operation(summary = "로그인", description = "이메일, 비밀번호로 로그인 후 JWT토큰 발급")
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        String token = authService.login(request);
        User user = authService.getUserByEmail(request.getEmail());
        return ResponseEntity.ok(new LoginResponse(token, user.getEmail(), user.getName()));
    }
}   
