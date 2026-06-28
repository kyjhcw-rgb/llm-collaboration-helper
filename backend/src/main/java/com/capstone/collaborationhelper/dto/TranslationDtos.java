package com.capstone.collaborationhelper.dto;

import lombok.Data;

import java.util.List;

/**
 * FastAPI(LLM) ↔ Spring 변환(translation) 전용 계약.
 * 중첩 트리(기능 ⊃ 클래스 ⊃ 메서드) + 관계(edges). 좌표·핸들 등 캔버스 UI 필드는 포함하지 않음.
 */
public class TranslationDtos {

    @Data
    public static class DiagramRes {
        private List<FeatureNode> features;
        private List<RelationEdge> edges;
    }

    @Data
    public static class FeatureNode {
        private String id;
        private String name;
        private String description;
        /** 클래스·인터페이스 공통. 상속/구현 구분은 edges.kind(INHERIT, IMPLEMENT)로 표현. */
        private List<ClassNode> classes;
    }

    /** 클래스·인터페이스 공통 노드. */
    @Data
    public static class ClassNode {
        private String id;
        private String name;
        private String description;
        private String annotations;
        private List<MethodNode> methods;
    }

    @Data
    public static class MethodNode {
        private String id;
        private String name;
        private String description;
        private String parameters;
        private String returnType;
    }

    /**
     * 호출·상속·구현 관계. kind: CALL, INHERIT, IMPLEMENT (대소문자 무관하게 mapper에서 정규화).
     */
    @Data
    public static class RelationEdge {
        private String id;
        private String fromId;
        private String to;
        private String kind;

        // React Flow의 CustomNode 핸들 ID와 매칭 (top, bottom, left, right)
        private String sourceHandle;
        private String targetHandle;
    }
}
