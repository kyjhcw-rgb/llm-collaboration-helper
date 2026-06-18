package com.capstone.collaborationhelper.mapper;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.dto.CanvasDtos.BlockDto;
import com.capstone.collaborationhelper.dto.CanvasDtos.EdgeDto;
import com.capstone.collaborationhelper.dto.TranslationDtos.*;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 중첩 트리(features ⊃ classes ⊃ methods) ↔ DB/캔버스용 flat Block·Edge 변환.
 */
@Component
public class TranslationMapper {

    private static final double FEATURE_GAP_X = 480;

    public CanvasDtos.SyncReq toCanvasSync(DiagramRes diagram) {
        if (diagram == null) {
            return emptySync();
        }

        List<BlockDto> blocks = new ArrayList<>();
        List<FeatureNode> features = diagram.getFeatures() != null ? diagram.getFeatures() : List.of();

        for (int fi = 0; fi < features.size(); fi++) {
            FeatureNode feature = features.get(fi);
            if (feature == null || isBlank(feature.getId())) {
                continue;
            }

            double featureX = 40 + fi * FEATURE_GAP_X;
            double featureY = 40;
            blocks.add(block(
                    feature.getId(), null, "feature",
                    feature.getName(), feature.getDescription(),
                    null, null, null,
                    featureX, featureY
            ));

            List<ClassNode> classes = feature.getClasses() != null ? feature.getClasses() : List.of();
            appendClasses(blocks, feature.getId(), classes);
        }

        Set<String> blockIds = blocks.stream().map(BlockDto::getFrontendId).collect(Collectors.toSet());
        List<EdgeDto> edges = mapEdges(diagram.getEdges(), blockIds);

        CanvasDtos.SyncReq syncReq = new CanvasDtos.SyncReq();
        syncReq.setBlocks(blocks);
        syncReq.setEdges(edges);
        return syncReq;
    }

    public DiagramRes fromCanvasSync(List<BlockDto> blocks, List<EdgeDto> edges) {
        DiagramRes diagram = new DiagramRes();
        if (blocks == null || blocks.isEmpty()) {
            diagram.setEdges(mapEdgesFromCanvas(edges));
            return diagram;
        }

        Map<String, List<BlockDto>> childrenByParent = new HashMap<>();
        for (BlockDto block : blocks) {
            String parent = block.getParentFrontendId();
            if (parent != null) {
                childrenByParent.computeIfAbsent(parent, k -> new ArrayList<>()).add(block);
            }
        }

        List<FeatureNode> features = blocks.stream()
                .filter(b -> b.getParentFrontendId() == null)
                .filter(b -> "feature".equalsIgnoreCase(normalizeCanvasType(b.getType())))
                .map(b -> toFeatureNode(b, childrenByParent))
                .toList();

        diagram.setFeatures(features);
        diagram.setEdges(mapEdgesFromCanvas(edges));
        return diagram;
    }

    private void appendClasses(
            List<BlockDto> blocks, String featureId, List<ClassNode> classes
    ) {
        if (classes == null) return;
        int offset = 0;
        for (int ci = 0; ci < classes.size(); ci++) {
            ClassNode classNode = classes.get(ci);
            if (classNode == null || isBlank(classNode.getId())) continue;
            double classX = 24;
            double classY = 48 + offset * 130;
            offset++;
            blocks.add(block(
                    classNode.getId(), featureId, "class",
                    classNode.getName(), classNode.getDescription(),
                    null, null, classNode.getAnnotations(),
                    classX, classY
            ));
            appendMethods(blocks, classNode.getId(), classNode.getMethods());
        }
    }

    private void appendMethods(
            List<BlockDto> blocks,
            String parentId,
            List<MethodNode> methods
    ) {
        if (methods == null) {
            return;
        }
        for (int mi = 0; mi < methods.size(); mi++) {
            MethodNode method = methods.get(mi);
            if (method == null || isBlank(method.getId())) {
                continue;
            }
            double methodX = 20;
            double methodY = 36 + mi * 56;
            blocks.add(block(
                    method.getId(), parentId, "method",
                    method.getName(), method.getDescription(),
                    method.getParameters(), method.getReturnType(), null,
                    methodX, methodY
            ));
        }
    }

    private FeatureNode toFeatureNode(BlockDto featureBlock, Map<String, List<BlockDto>> childrenByParent) {
        FeatureNode feature = new FeatureNode();
        feature.setId(featureBlock.getFrontendId());
        feature.setName(featureBlock.getName());
        feature.setDescription(featureBlock.getDescription());

        List<BlockDto> children = childrenByParent.getOrDefault(feature.getId(), List.of());
        List<ClassNode> classes = children.stream()
                .filter(b -> "class".equals(normalizeCanvasType(b.getType())))
                .map(b -> toClassNode(b, childrenByParent))
                .toList();

        feature.setClasses(classes);
        return feature;
    }

    private ClassNode toClassNode(BlockDto classBlock, Map<String, List<BlockDto>> childrenByParent) {
        ClassNode classNode = new ClassNode();
        classNode.setId(classBlock.getFrontendId());
        classNode.setName(classBlock.getName());
        classNode.setDescription(classBlock.getDescription());
        classNode.setAnnotations(classBlock.getAnnotations());

        List<MethodNode> methods = childrenByParent.getOrDefault(classNode.getId(), List.of()).stream()
                .filter(b -> "method".equalsIgnoreCase(normalizeCanvasType(b.getType())))
                .map(this::toMethodNode)
                .toList();
        classNode.setMethods(methods);
        return classNode;
    }

    private MethodNode toMethodNode(BlockDto methodBlock) {
        MethodNode method = new MethodNode();
        method.setId(methodBlock.getFrontendId());
        method.setName(methodBlock.getName());
        method.setDescription(methodBlock.getDescription());
        method.setParameters(methodBlock.getParameters());
        method.setReturnType(methodBlock.getReturnType());
        return method;
    }

    private List<RelationEdge> mapEdgesFromCanvas(List<EdgeDto> edges) {
        if (edges == null) {
            return List.of();
        }
        return edges.stream().map(e -> {
            RelationEdge rel = new RelationEdge();
            rel.setId(e.getFrontendId());
            rel.setFromId(e.getSourceFrontendId());
            rel.setTo(e.getTargetFrontendId());
            rel.setKind(normalizeEdgeKindToTranslation(e.getType()));
            return rel;
        }).toList();
    }

    private List<EdgeDto> mapEdges(List<RelationEdge> relations, Set<String> blockIds) {
        if (relations == null) {
            return List.of();
        }
        List<EdgeDto> edges = new ArrayList<>();
        for (RelationEdge rel : relations) {
            if (rel == null || isBlank(rel.getId()) || isBlank(rel.getFromId()) || isBlank(rel.getTo())) {
                continue;
            }
            if (!blockIds.contains(rel.getFromId()) || !blockIds.contains(rel.getTo())) {
                continue;
            }
            EdgeDto edge = new EdgeDto();
            edge.setFrontendId(rel.getId());
            edge.setSourceFrontendId(rel.getFromId());
            edge.setTargetFrontendId(rel.getTo());
            edge.setType(normalizeEdgeKindToCanvas(rel.getKind()));
            edge.setSourceHandle("bottom");
            edge.setTargetHandle("top");
            edge.setBadgeCount(1);
            edges.add(edge);
        }
        return edges;
    }

    private BlockDto block(
            String id, String parentId, String type,
            String name, String description,
            String parameters, String returnType, String annotations,
            double posX, double posY
    ) {
        BlockDto dto = new BlockDto();
        dto.setFrontendId(id);
        dto.setParentFrontendId(parentId);
        dto.setType(type);
        dto.setName(name != null ? name : "Untitled");
        dto.setDescription(description != null ? description : "");
        dto.setParameters(parameters);
        dto.setReturnType(returnType);
        dto.setAnnotations(annotations);
        dto.setPosX(posX);
        dto.setPosY(posY);
        return dto;
    }

    private CanvasDtos.SyncReq emptySync() {
        CanvasDtos.SyncReq syncReq = new CanvasDtos.SyncReq();
        syncReq.setBlocks(List.of());
        syncReq.setEdges(List.of());
        return syncReq;
    }

    private String normalizeEdgeKindToCanvas(String kind) {
        if (kind == null) {
            return "call";
        }
        return switch (kind.toUpperCase(Locale.ROOT)) {
            case "INHERIT" -> "inheritance";
            case "IMPLEMENT" -> "implementation";
            default -> "call";
        };
    }

    private String normalizeEdgeKindToTranslation(String type) {
        if (type == null) {
            return "CALL";
        }
        return switch (type.toLowerCase(Locale.ROOT)) {
            case "inheritance", "inherit" -> "INHERIT";
            case "implementation", "implement" -> "IMPLEMENT";
            default -> "CALL";
        };
    }

    private String normalizeCanvasType(String type) {
        if (type == null) {
            return "feature";
        }
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "FUNCTION", "FEATURE" -> "feature";
            case "CLASS" -> "class";
            case "INTERFACE" -> "class";
            case "METHOD" -> "method";
            default -> type.toLowerCase(Locale.ROOT);
        };
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
