package com.capstone.collaborationhelper.code2diagram;

import com.capstone.collaborationhelper.code2diagram.ingest.SourceFileCollector;
import com.capstone.collaborationhelper.code2diagram.map.DiagramMapper;
import com.capstone.collaborationhelper.code2diagram.parse.JavaSourceParser;
import com.capstone.collaborationhelper.dto.TranslationDtos.ClassNode;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.capstone.collaborationhelper.dto.TranslationDtos.FeatureNode;
import com.capstone.collaborationhelper.dto.TranslationDtos.RelationEdge;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class CodeToDiagramServiceTest {

    private CodeToDiagramService service;
    private Path fixtureRoot;

    @BeforeEach
    void setUp() {
        service = new CodeToDiagramService(
                new SourceFileCollector(),
                new JavaSourceParser(),
                new DiagramMapper()
        );
        fixtureRoot = Path.of("src/test/resources/fixtures/sample-spring");
    }

    @Test
    void fromSources_buildsFeaturesClassesMethodsAndImplementEdge() throws Exception {
        DiagramRes diagram = service.fromSources(fixtureRoot);

        assertThat(diagram.getFeatures()).isNotEmpty();

        Set<String> featureNames = diagram.getFeatures().stream()
                .map(FeatureNode::getName)
                .collect(Collectors.toSet());
        assertThat(featureNames).contains("controller", "service", "dto");

        Set<String> classNames = diagram.getFeatures().stream()
                .flatMap(f -> f.getClasses().stream())
                .map(ClassNode::getName)
                .collect(Collectors.toSet());
        assertThat(classNames).contains("FooController", "FooService", "FooDto", "FooRepository", "FooServiceImpl");

        ClassNode controller = findClass(diagram, "FooController");
        assertThat(controller.getAnnotations()).contains("@RestController");
        assertThat(controller.getMethods())
                .extracting(m -> m.getName())
                .contains("getFoo")
                .doesNotContain("helper");

        List<RelationEdge> implementEdges = diagram.getEdges().stream()
                .filter(e -> "IMPLEMENT".equals(e.getKind()))
                .toList();
        assertThat(implementEdges).isNotEmpty();
    }

    private ClassNode findClass(DiagramRes diagram, String name) {
        return diagram.getFeatures().stream()
                .flatMap(f -> f.getClasses().stream())
                .filter(c -> name.equals(c.getName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("class not found: " + name));
    }
}
