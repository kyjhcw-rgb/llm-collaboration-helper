package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.client.LlmClient;
import com.capstone.collaborationhelper.dto.DatabaseDtos.GenerateDdlRes;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.PartyRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class DatabaseDdlService {

    private static final Set<String> SUPPORTED_DB = Set.of("mysql", "postgresql");
    private static final String DEFAULT_DB_TYPE = "mysql";

    private final ProjectRepository projectRepository;
    private final PartyRepository partyRepository;
    private final UserRepository userRepository;
    private final TranslationService translationService;
    private final LlmClient llmClient;

    public record DdlFile(byte[] content, String filename) {}

    /**
     * DB live 다이어그램 → AI generate-database-ddl → .sql bytes.
     */
    @Transactional(readOnly = true)
    public DdlFile buildSqlFile(Integer projectId, String dbType) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("프로젝트를 찾을 수 없습니다."));
        assertPartyMember(project);

        String normalized = normalizeDbType(dbType);
        DiagramRes diagram = translationService.exportFromDb(projectId, null);
        GenerateDdlRes ddl = llmClient.requestDatabaseDdl(diagram, normalized);

        String body = buildSqlBody(ddl);
        String filename = sqlFileName(project, normalized);
        return new DdlFile(body.getBytes(StandardCharsets.UTF_8), filename);
    }

    private String normalizeDbType(String dbType) {
        String value = (dbType == null || dbType.isBlank())
                ? DEFAULT_DB_TYPE
                : dbType.trim().toLowerCase(Locale.ROOT);
        if (!SUPPORTED_DB.contains(value)) {
            throw new RuntimeException("지원하지 않는 dbType입니다. mysql 또는 postgresql을 사용하세요.");
        }
        return value;
    }

    private String buildSqlBody(GenerateDdlRes ddl) {
        StringBuilder sb = new StringBuilder();
        if (ddl.getSummary() != null && !ddl.getSummary().isBlank()) {
            for (String line : ddl.getSummary().split("\\R")) {
                sb.append("-- ").append(line).append('\n');
            }
            sb.append('\n');
        }
        sb.append(ddl.getSql().trim()).append('\n');
        return sb.toString();
    }

    private String sqlFileName(Project project, String dbType) {
        String title = project.getTitle() != null ? project.getTitle().trim() : "project";
        String safe = title.replaceAll("[\\\\/:*?\"<>|\\s]+", "_");
        if (safe.isBlank()) safe = "project";
        return safe + "-" + dbType + ".sql";
    }

    private void assertPartyMember(Project project) {
        User me = currentUser();
        if (partyRepository.findByProjectAndUser(project, me).isEmpty()) {
            throw new RuntimeException("이 프로젝트에 접근할 권한이 없습니다.");
        }
    }

    private User currentUser() {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("로그인 사용자를 찾을 수 없습니다."));
    }
}
