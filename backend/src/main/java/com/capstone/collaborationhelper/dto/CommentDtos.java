package com.capstone.collaborationhelper.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.OffsetDateTime;

public class CommentDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Req {
        private String content;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Res {
        private Integer id;
        private String blockFrontendId;
        private Integer userId;
        private String nickname;
        private String content;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }
}