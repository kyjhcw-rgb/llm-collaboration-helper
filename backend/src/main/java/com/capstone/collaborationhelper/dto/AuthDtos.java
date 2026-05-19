package com.capstone.collaborationhelper.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

public class AuthDtos {

    // 1. 인증 메일 발송 요청 DTO
    @Getter
    @Setter
    @NoArgsConstructor
    public static class EmailSendReq {
        private String email;
    }

    // 2. 인증 번호 확인 요청 DTO
    @Getter
    @Setter
    @NoArgsConstructor
    public static class EmailVerifyReq {
        private String email;
        private String code;
    }

    // 3. 회원가입 요청 DTO
    @Getter
    @Setter
    @NoArgsConstructor
    public static class SignupReq {
        private String username;
        private String password;
        private String nickname;
        private String email;
    }

    // 4. 로그인 요청 DTO
    @Getter
    @Setter
    @NoArgsConstructor
    public static class LoginReq {
        private String username;
        private String password;
    }
}