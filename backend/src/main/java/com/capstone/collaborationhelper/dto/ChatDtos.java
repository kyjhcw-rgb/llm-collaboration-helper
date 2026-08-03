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

    /**
     * Agent 모드 응답 — reply + 캔버스와 동일한 flat blocks/edges.
     * FastAPI features 트리를 TranslationMapper로 변환한 결과. DB 미반영.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AgentRes {
        private String reply;
        private List<CanvasDtos.BlockDto> blocks;
        private List<CanvasDtos.EdgeDto> edges;
    }

    /** Spring → FastAPI /project/ask 요청 */
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
        private String mode;
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

    /** FastAPI /project/ask 응답 */
    @Data
    public static class LlmChatRes {
        private String reply;
    }

    /** FastAPI /project/agent 응답 — 요청은 LlmChatReq 공용 */
    @Data
    public static class LlmModifyRes {
        private String reply;
        private DiagramRes diagram;
    }
}
