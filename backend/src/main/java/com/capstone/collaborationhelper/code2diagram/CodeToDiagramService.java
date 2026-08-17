package com.capstone.collaborationhelper.code2diagram;

import com.capstone.collaborationhelper.code2diagram.ingest.GitHubRepoFetcher;
import com.capstone.collaborationhelper.code2diagram.ingest.GitHubRepoFetcher.FetchedRepo;
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
 * 소스 루트 / 공개 GitHub URL → DiagramRes 파이프라인 facade.
 * (HTTP 엔드포인트는 아직 없음 — 입력 계층만)
 */
@Service
@RequiredArgsConstructor
public class CodeToDiagramService {

    private final SourceFileCollector sourceFileCollector;
    private final JavaSourceParser javaSourceParser;
    private final DiagramMapper diagramMapper;
    private final GitHubRepoFetcher gitHubRepoFetcher;

    public DiagramRes fromSources(Path root) throws IOException {
        List<Path> files = sourceFileCollector.collect(root);
        List<ParsedType> types = javaSourceParser.parseAll(files);
        return diagramMapper.toDiagram(types);
    }

    /**
     * 공개 GitHub 레포 URL을 받아 임시로 받은 뒤 fromSources에 넘긴다.
     */
    public DiagramRes fromGitHubUrl(String repoUrl) throws IOException {
        try (FetchedRepo fetched = gitHubRepoFetcher.fetch(repoUrl)) {
            return fromSources(fetched.projectRoot());
        }
    }
}
