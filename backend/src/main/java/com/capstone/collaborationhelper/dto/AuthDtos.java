package com.capstone.collaborationhelper.dto;
import lombok.Data;

public class AuthDtos {
    @Data public static class EmailSendReq { private String email; }

    @Data public static class EmailVerifyReq { private String email; private String code; }

    @Data public static class SignupReq {
        private String username;
        private String password;
        private String email;
        private String nickname;
    }

    @Data public static class LoginReq {
        private String username;
        private String password;
    }
}