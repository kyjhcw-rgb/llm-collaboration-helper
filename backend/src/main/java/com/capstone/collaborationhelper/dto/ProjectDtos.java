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
        private String myRole;

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

        // 권한(Role) 정보까지 한 번에 담아서 생성하는 오버로딩 메서드 추가
        public static Res from(Project project, String myRole) {
            return Res.builder()
                    .id(project.getId())
                    .title(project.getTitle())
                    .framework(project.getFramework())
                    .freedomLevel(project.getFreedomLevel())
                    .descriptionPrompt(project.getDescriptionPrompt())
                    .diagramState(project.getDiagramState())
                    .myRole(myRole)
                    .build();
        }
    }
}
