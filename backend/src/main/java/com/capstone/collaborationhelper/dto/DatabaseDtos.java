package com.capstone.collaborationhelper.dto;

import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** FastAPI generate-database-ddl 계약 (Python DatabaseGenerateRequest/Response와 1:1). */
public class DatabaseDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GenerateDdlReq {
        private DiagramRes diagram;
        private String dbType;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GenerateDdlRes {
        private String dbType;
        private String sql;
        private String summary;
    }
}
