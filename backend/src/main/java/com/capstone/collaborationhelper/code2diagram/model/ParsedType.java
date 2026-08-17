package com.capstone.collaborationhelper.code2diagram.model;

import lombok.Builder;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Java 클래스·인터페이스 IR. DiagramRes.ClassNode로 매핑되기 전 단계.
 */
@Data
@Builder
public class ParsedType {
    /** 단순 이름. 예: AuthService */
    private String simpleName;
    /** 패키지. 예: com.capstone.collaborationhelper.service */
    private String packageName;
    /** FQN. 예: com.capstone.collaborationhelper.service.AuthService */
    private String fqn;
    /** class | interface */
    private String kind;
    /** 예: ["RestController", "RequestMapping"] — @ 제외 단순명 */
    @Builder.Default
    private List<String> annotations = new ArrayList<>();
    @Builder.Default
    private List<ParsedMethod> methods = new ArrayList<>();
    /** extends 대상 단순명 또는 FQN */
    @Builder.Default
    private List<String> extendedTypes = new ArrayList<>();
    /** implements 대상 */
    @Builder.Default
    private List<String> implementedTypes = new ArrayList<>();
    private String sourcePath;
}
