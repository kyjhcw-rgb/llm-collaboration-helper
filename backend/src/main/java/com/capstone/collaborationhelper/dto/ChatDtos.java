package com.capstone.collaborationhelper.dto;

import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public class ChatDtos {

    @Data
    public static class ChatReq {
        @NotBlank(message = "질문 내용은 필수입니다.")
        @Size(max = 4000, message = "질문은 4000자 이하여야 합니다.")
        private String message;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatRes {
        private String reply;
    }

    /** Spring → FastAPI /chat 요청 */
    @Data
    public static class LlmChatReq {
        private String message;
        private DiagramRes diagram;
        private List<HistoryTurn> history = new ArrayList<>();
        private String projectContext;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MessageRes {
        private Integer id;
        private String sender;
        private String message;
        private OffsetDateTime createdAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HistoryTurn {
        private String sender;
        private String message;
    }

    /** FastAPI /chat 응답 */
    @Data
    public static class LlmChatRes {
        private String reply;
    }
}
