package com.capstone.collaborationhelper.mapper;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.dto.CanvasDtos.BlockDto;
import com.capstone.collaborationhelper.dto.CanvasDtos.EdgeDto;
import com.capstone.collaborationhelper.dto.TranslationDtos.*;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 중첩 트리(folders ⊃ classes ⊃ methods) ↔ DB/캔버스용 flat Block·Edge 변환.
 * 캔버스 최상위 블록 type은 기존 호환을 위해 "feature"를 유지한다.
 */
@Component
public class TranslationMapper {

    private static final double FOLDER_GAP_X = 480;
    private static final String CANVAS_FOLDER_TYPE = "feature";

    public CanvasDtos.SyncReq toCanvasSync(DiagramRes diagram) {
        if (diagram == null) {
            return emptySync();
        }

        List<BlockDto> blocks = new ArrayList<>();
        List<FolderNode> folders = diagram.getFolders() != null ? diagram.getFolders() : List.of();

        for (int fi = 0; fi < folders.size(); fi++) {
            FolderNode folder = folders.get(fi);
            if (folder == null || isBlank(folder.getId())) {
                continue;
            }

            double folderX = 40 + fi * FOLDER_GAP_X;
            double folderY = 40;
            blocks.add(block(
                    folder.getId(), null, CANVAS_FOLDER_TYPE,
                    folder.getName(), folder.getDescription(),
                    null, null, null,
                    folderX, folderY
            ));

            List<ClassNode> classes = folder.getClasses() != null ? folder.getClasses() : List.of();
            appendClasses(blocks, folder.getId(), classes);
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

        List<FolderNode> folders = blocks.stream()
                .filter(b -> b.getParentFrontendId() == null)
                .filter(b -> CANVAS_FOLDER_TYPE.equalsIgnoreCase(normalizeCanvasType(b.getType())))
                .map(b -> toFolderNode(b, childrenByParent))
                .toList();

        diagram.setFolders(folders);
        diagram.setEdges(mapEdgesFromCanvas(edges));
        return diagram;
    }

    private void appendClasses(
            List<BlockDto> blocks, String folderId, List<ClassNode> classes
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
                    classNode.getId(), folderId, "class",
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

    private FolderNode toFolderNode(BlockDto folderBlock, Map<String, List<BlockDto>> childrenByParent) {
        FolderNode folder = new FolderNode();
        folder.setId(folderBlock.getFrontendId());
        folder.setName(folderBlock.getName());
        folder.setDescription(folderBlock.getDescription());

        List<BlockDto> children = childrenByParent.getOrDefault(folder.getId(), List.of());
        List<ClassNode> classes = children.stream()
                .filter(b -> "class".equals(normalizeCanvasType(b.getType())))
                .map(b -> toClassNode(b, childrenByParent))
                .toList();

        folder.setClasses(classes);
        return folder;
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
            return CANVAS_FOLDER_TYPE;
        }
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "FUNCTION", "FEATURE", "FOLDER" -> CANVAS_FOLDER_TYPE;
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
