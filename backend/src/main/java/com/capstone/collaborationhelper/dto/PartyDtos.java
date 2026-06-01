package com.capstone.collaborationhelper.dto;

import com.capstone.collaborationhelper.entity.Party;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

import java.time.OffsetDateTime;

public class PartyDtos {

    /**
     * 멤버 초대 요청 DTO
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InviteReq {
        @NotBlank(message = "초대할 유저의 이메일은 필수입니다.")
        @Email(message = "올바른 이메일 형식이 아닙니다.")
        private String email;

        @NotBlank(message = "역할 설정은 필수입니다.")
        @Pattern(regexp = "^(MEMBER|GUEST)$", message = "역할은 MEMBER 또는 GUEST만 가능합니다.")
        private String role;
    }

    /**
     * 멤버 권한 수정 요청 DTO
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateRoleReq {
        @NotBlank(message = "변경할 역할은 필수입니다.")
        @Pattern(regexp = "^(MEMBER|GUEST)$", message = "역할은 MEMBER 또는 GUEST만 가능합니다.")
        private String role;
    }

    /**
     * 멤버 정보 응답 DTO
     */
    @Getter
    @Builder
    @AllArgsConstructor
    public static class Res {
        private Integer userId;
        private String username;
        private String nickname;
        private String email;
        private String role;
        private OffsetDateTime joinedAt;

        /**
         * Entity -> DTO 변환 메서드
         */
        public static Res from(Party party) {
            return Res.builder()
                    .userId(party.getUser().getId())
                    .username(party.getUser().getUsername())
                    .nickname(party.getUser().getNickname())
                    .email(party.getUser().getEmail())
                    .role(party.getRole())
                    .joinedAt(party.getJoinedAt())
                    .build();
        }
    }
}