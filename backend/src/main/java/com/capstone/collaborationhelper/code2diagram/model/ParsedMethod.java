package com.capstone.collaborationhelper.code2diagram.model;

import lombok.Builder;
import lombok.Data;

/**
 * Java 메서드 시그니처 IR. DiagramRes.MethodNode로 매핑되기 전 단계.
 */
@Data
@Builder
public class ParsedMethod {
    private String name;
    /** 예: "String email, String password" */
    private String parameters;
    /** 예: "ResponseEntity" — void면 "void" */
    private String returnType;
    private boolean isPublic;
}
