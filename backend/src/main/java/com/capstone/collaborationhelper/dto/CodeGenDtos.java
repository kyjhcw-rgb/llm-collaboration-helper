package com.capstone.collaborationhelper.dto;

import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/** FastAPI diagram-to-code 계약 (Python DiagramToCodeRequest/Response와 1:1). */
public class CodeGenDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiagramToCodeReq {
        private DiagramRes diagram;
        private String targetFramework;
        private String basePackage;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiagramToCodeRes {
        /** Key: 상대 경로, Value: 소스 코드 */
        private Map<String, String> files;
    }
}
