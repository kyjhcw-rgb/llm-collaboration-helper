package com.capstone.collaborationhelper.dto;

import com.capstone.collaborationhelper.entity.Project;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Data;
import java.time.ZonedDateTime;
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
                    .createdAt(p.getCreatedAt())
                    .updatedAt(p.getUpdatedAt())
                    .build();
        }
    }
}
