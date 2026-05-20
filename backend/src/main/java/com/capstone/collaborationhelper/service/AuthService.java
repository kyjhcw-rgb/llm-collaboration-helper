package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.AuthDtos.*;
import com.capstone.collaborationhelper.entity.EmailVerification;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.EmailVerificationRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import com.capstone.collaborationhelper.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final EmailVerificationRepository verificationRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public void signup(SignupReq request) {
        if (userRepository.existsByUsername(request.getUsername())) throw new RuntimeException("이미 사용 중인 아이디입니다.");
        if (userRepository.existsByEmail(request.getEmail())) throw new RuntimeException("이미 가입된 이메일입니다.");

        // 이메일이 진짜로 인증되었는지 확인
        EmailVerification verification = verificationRepo.findTopByEmailOrderByCreatedAtDesc(request.getEmail())
                .orElseThrow(() -> new RuntimeException("이메일 인증을 먼저 진행해주세요."));
        if (!verification.isVerified()) throw new RuntimeException("이메일 인증이 완료되지 않았습니다.");

        // 유저 생성
        userRepository.save(User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .nickname(request.getNickname())
                .password(passwordEncoder.encode(request.getPassword()))
                .build());
    }

    public String login(LoginReq request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("가입되지 않은 아이디입니다."));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) throw new RuntimeException("비밀번호 불일치");

        return jwtTokenProvider.createToken(user.getUsername());
    }

    // 정보 수정 로직
    @Transactional
    public void updateUserInfo(String username, UserUpdateReq req) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        // 닉네임 변경
        if (req.getNickname() != null && !req.getNickname().trim().isEmpty()) {
            user.setNickname(req.getNickname());
        }

        // 프로필 이미지 URL 변경
        if (req.getProfileImageUrl() != null) {
            user.setProfileImageUrl(req.getProfileImageUrl());
        }

        // 비밀번호 변경 (새 비밀번호가 있을 경우 기존 비밀번호 검증)
        if (req.getNewPassword() != null && !req.getNewPassword().trim().isEmpty()) {
            if (req.getCurrentPassword() == null || !passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
                throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다.");
            }
            user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        }
    }
}