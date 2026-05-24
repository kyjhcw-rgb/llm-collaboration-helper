package com.capstone.collaborationhelper.dto;

import com.capstone.collaborationhelper.entity.Project;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Data;
import java.time.ZonedDateTime;
import java.util.List; // 💡 List 임포트 확인

public class ProjectDtos {

    @Data
    public static class CreateReq {
        @NotBlank(message = "프로젝트 제목은 필수입니다.")
        private String title;
        private String framework;
        private Integer freedomLevel;
        private String descriptionPrompt;
    }

    @Data
    public static class UpdateReq {
        private String title;
        private String framework;
        private Integer freedomLevel;
        private String descriptionPrompt;
        private String diagramState;
        private Integer version;
    }

    @Data
    @Builder
    public static class Res {
        private Integer id;
        private Integer ownerId;
        private String ownerUsername;
        private String title;
        private String framework;
        private Integer freedomLevel;
        private String descriptionPrompt;
        private String diagramState;
        private Integer version;
        private ZonedDateTime createdAt;
        private ZonedDateTime updatedAt;

        public static Res from(Project p) {
            return Res.builder()
                    .id(p.getId()).ownerId(p.getOwner().getId())
                    .ownerUsername(p.getOwner().getUsername())
                    .title(p.getTitle())
                    .framework(p.getFramework())
                    .freedomLevel(p.getFreedomLevel())
                    .descriptionPrompt(p.getDescriptionPrompt())
                    .diagramState(p.getDiagramState())
                    .version(p.getVersion())
                    .createdAt(p.getCreatedAt())
                    .updatedAt(p.getUpdatedAt())
                    .build();
        }
    }

    // 프로젝트에서 LLM이 준 json을 받는 부분 형식 정의
    
    @Data
    public static class LlmDiagramRes {
        // 파이썬의 LlmBlockResponse 리스트가 자바의 CanvasDtos.BlockDto 리스트로 매핑됩니다.
        private List<CanvasDtos.BlockDto> blocks;
        
        // 파이썬의 LlmEdgeResponse 리스트가 자바의 CanvasDtos.EdgeDto 리스트로 매핑됩니다.
        private List<CanvasDtos.EdgeDto> edges;
    }
}
