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

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyncRes {
        private Integer version;
        private List<BlockDto> blocks;
        private List<EdgeDto> edges;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SaveRes {
        private Integer newVersion;
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