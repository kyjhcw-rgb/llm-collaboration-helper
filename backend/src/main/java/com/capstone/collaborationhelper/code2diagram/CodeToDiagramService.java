package com.capstone.collaborationhelper.code2diagram;

import com.capstone.collaborationhelper.code2diagram.ingest.SourceFileCollector;
import com.capstone.collaborationhelper.code2diagram.map.DiagramMapper;
import com.capstone.collaborationhelper.code2diagram.model.ParsedType;
import com.capstone.collaborationhelper.code2diagram.parse.JavaSourceParser;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/**
 * 소스 루트 → DiagramRes 파이프라인 facade.
 */
@Service
@RequiredArgsConstructor
public class CodeToDiagramService {

    private final SourceFileCollector sourceFileCollector;
    private final JavaSourceParser javaSourceParser;
    private final DiagramMapper diagramMapper;

    public DiagramRes fromSources(Path root) throws IOException {
        List<Path> files = sourceFileCollector.collect(root);
        List<ParsedType> types = javaSourceParser.parseAll(files);
        return diagramMapper.toDiagram(types);
    }
}
