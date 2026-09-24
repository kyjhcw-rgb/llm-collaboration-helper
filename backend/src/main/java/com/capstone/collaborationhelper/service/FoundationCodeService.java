package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.client.LlmClient;
import com.capstone.collaborationhelper.dto.CodeGenDtos.DiagramToCodeRes;
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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class FoundationCodeService {

    private static final String DEFAULT_BASE_PACKAGE = "com.example";
    private static final String DEFAULT_FRAMEWORK = "spring";

    private final ProjectRepository projectRepository;
    private final PartyRepository partyRepository;
    private final UserRepository userRepository;
    private final TranslationService translationService;
    private final LlmClient llmClient;

    /**
     * DB live 다이어그램 → AI diagram-to-code → zip bytes.
     */
    @Transactional(readOnly = true)
    public byte[] buildZip(Integer projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("프로젝트를 찾을 수 없습니다."));
        assertPartyMember(project);

        DiagramRes diagram = translationService.exportFromDb(projectId, null);
        String framework = (project.getFramework() != null && !project.getFramework().isBlank())
                ? project.getFramework()
                : DEFAULT_FRAMEWORK;

        DiagramToCodeRes codeRes = llmClient.requestDiagramToCode(
                diagram, framework, DEFAULT_BASE_PACKAGE);

        try {
            return zipFiles(codeRes.getFiles());
        } catch (IOException e) {
            throw new RuntimeException("코드 zip 생성에 실패했습니다.", e);
        }
    }

    public String zipFileName(Integer projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("프로젝트를 찾을 수 없습니다."));
        String title = project.getTitle() != null ? project.getTitle().trim() : "project";
        String safe = title.replaceAll("[\\\\/:*?\"<>|\\s]+", "_");
        if (safe.isBlank()) safe = "project";
        return safe + "-foundation.zip";
    }

    private byte[] zipFiles(Map<String, String> files) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (Map.Entry<String, String> entry : files.entrySet()) {
                String path = normalizeZipPath(entry.getKey());
                if (path == null) {
                    log.warn("zip 경로 스킵 (unsafe): {}", entry.getKey());
                    continue;
                }
                zos.putNextEntry(new ZipEntry(path));
                String content = entry.getValue() != null ? entry.getValue() : "";
                zos.write(content.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }
        }
        return baos.toByteArray();
    }

    /** Zip slip 방지: 절대경로/.. 제거. */
    private String normalizeZipPath(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String path = raw.replace('\\', '/').replaceAll("^/+", "");
        if (path.contains("..") || path.startsWith("/")) return null;
        return path;
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
