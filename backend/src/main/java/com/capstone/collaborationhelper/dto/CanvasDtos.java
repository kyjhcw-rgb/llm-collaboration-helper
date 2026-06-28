package com.capstone.collaborationhelper.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

public class CanvasDtos {

    @Data
    public static class SyncReq {
        private List<BlockDto> blocks;
        private List<EdgeDto> edges;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class SyncRes {
        private List<BlockDto> blocks;
        private List<EdgeDto> edges;
    }

    @Data
    public static class CommitReq {
        private String commitMessage;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class VersionDto {
        private Integer versionNumber;
        private String commitMessage;
        private String createdAt;
    }

    @Data
    public static class BlockDto {
        private String frontendId;
        private String parentFrontendId;
        private String type;
        private String name;
        private String description;
        private String parameters;
        private String returnType;
        private String annotations;
        private Double posX;
        private Double posY;
        private Double width;
        private Double height;
    }

    @Data
    public static class EdgeDto {
        private String frontendId;
        private String sourceFrontendId;
        private String targetFrontendId;
        private String sourceHandle;
        private String targetHandle;
        private String type;
        private Integer badgeCount;
    }
}