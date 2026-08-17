package com.capstone.collaborationhelper.code2diagram.map;

import com.capstone.collaborationhelper.code2diagram.model.ParsedMethod;
import com.capstone.collaborationhelper.code2diagram.model.ParsedType;
import com.capstone.collaborationhelper.dto.TranslationDtos.ClassNode;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.capstone.collaborationhelper.dto.TranslationDtos.FeatureNode;
import com.capstone.collaborationhelper.dto.TranslationDtos.MethodNode;
import com.capstone.collaborationhelper.dto.TranslationDtos.RelationEdge;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * ParsedType IR → DiagramRes (features ⊃ classes ⊃ methods + edges).
 * MVP: feature = 패키지 마지막 세그먼트, edge = INHERIT / IMPLEMENT만.
 */
@Component
public class DiagramMapper {

    public DiagramRes toDiagram(List<ParsedType> types) {
        DiagramRes diagram = new DiagramRes();
        if (types == null || types.isEmpty()) {
            diagram.setFeatures(List.of());
            diagram.setEdges(List.of());
            return diagram;
        }

        Map<String, String> simpleNameToId = types.stream()
                .collect(Collectors.toMap(
                        ParsedType::getSimpleName,
                        this::classId,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        Map<String, List<ParsedType>> byFeature = new LinkedHashMap<>();
        for (ParsedType type : types) {
            String featureKey = featureKey(type);
            byFeature.computeIfAbsent(featureKey, k -> new ArrayList<>()).add(type);
        }

        List<FeatureNode> features = new ArrayList<>();
        for (Map.Entry<String, List<ParsedType>> entry : byFeature.entrySet()) {
            String key = entry.getKey();
            FeatureNode feature = new FeatureNode();
            feature.setId(featureId(key));
            feature.setName(key);
            feature.setDescription("");
            feature.setClasses(entry.getValue().stream().map(this::toClassNode).toList());
            features.add(feature);
        }

        diagram.setFeatures(features);
        diagram.setEdges(buildEdges(types, simpleNameToId));
        return diagram;
    }

    private ClassNode toClassNode(ParsedType type) {
        ClassNode node = new ClassNode();
        node.setId(classId(type));
        node.setName(type.getSimpleName());
        node.setDescription("");
        node.setAnnotations(formatAnnotations(type.getAnnotations()));
        node.setMethods(type.getMethods().stream()
                .filter(ParsedMethod::isPublic)
                .map(m -> toMethodNode(type, m))
                .toList());
        return node;
    }

    private MethodNode toMethodNode(ParsedType type, ParsedMethod method) {
        MethodNode node = new MethodNode();
        node.setId(methodId(type, method));
        node.setName(method.getName());
        node.setDescription("");
        node.setParameters(method.getParameters());
        node.setReturnType(method.getReturnType());
        return node;
    }

    private List<RelationEdge> buildEdges(
            List<ParsedType> types,
            Map<String, String> simpleNameToId
    ) {
        List<RelationEdge> edges = new ArrayList<>();
        Set<String> knownIds = Set.copyOf(simpleNameToId.values());
        int edgeSeq = 1;

        for (ParsedType type : types) {
            String fromId = classId(type);
            for (String parent : type.getExtendedTypes()) {
                String toId = simpleNameToId.get(simpleName(parent));
                if (toId != null && knownIds.contains(toId)) {
                    edges.add(edge(edgeSeq++, fromId, toId, "INHERIT"));
                }
            }
            for (String iface : type.getImplementedTypes()) {
                String toId = simpleNameToId.get(simpleName(iface));
                if (toId != null && knownIds.contains(toId)) {
                    edges.add(edge(edgeSeq++, fromId, toId, "IMPLEMENT"));
                }
            }
        }
        return edges;
    }

    private RelationEdge edge(int seq, String fromId, String toId, String kind) {
        RelationEdge edge = new RelationEdge();
        edge.setId("edge_" + seq);
        edge.setFromId(fromId);
        edge.setTo(toId);
        edge.setKind(kind);
        return edge;
    }

    private String featureKey(ParsedType type) {
        String pkg = type.getPackageName();
        if (pkg == null || pkg.isBlank()) {
            return "default";
        }
        int dot = pkg.lastIndexOf('.');
        return dot >= 0 ? pkg.substring(dot + 1) : pkg;
    }

    private String featureId(String key) {
        return "feat_" + sanitize(key);
    }

    private String classId(ParsedType type) {
        return "cls_" + sanitize(type.getFqn());
    }

    private String methodId(ParsedType type, ParsedMethod method) {
        return "method_" + sanitize(type.getFqn()) + "_" + sanitize(method.getName());
    }

    private String formatAnnotations(List<String> annotations) {
        if (annotations == null || annotations.isEmpty()) {
            return null;
        }
        return annotations.stream()
                .map(a -> a.startsWith("@") ? a : "@" + a)
                .collect(Collectors.joining(" "));
    }

    private String simpleName(String typeName) {
        if (typeName == null) {
            return "";
        }
        int dot = typeName.lastIndexOf('.');
        String bare = dot >= 0 ? typeName.substring(dot + 1) : typeName;
        int generic = bare.indexOf('<');
        return generic >= 0 ? bare.substring(0, generic) : bare;
    }

    private String sanitize(String raw) {
        if (raw == null || raw.isBlank()) {
            return "unknown";
        }
        return raw.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_");
    }
}
