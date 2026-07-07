package com.capstone.collaborationhelper.client;

import com.capstone.collaborationhelper.dto.ProjectDtos.*;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class LlmClient {

    private final Environment environment;
    private final RestTemplate restTemplate;

    private String getBaseUrl() {
        return environment.getProperty("app.ai-server.url").replaceAll("/$", "");
    }

    // [기능 2] 초기 다이어그램 생성 요청
    public DiagramRes requestInitialDiagram(CreateReq req) {
        String url = getBaseUrl() + "/projects/initial-diagram";
        log.info("▶ [LlmClient] AI 서버로 다이어그램 생성 요청. url={}, title={}", url, req.getTitle());
        try {
            return restTemplate.postForObject(url, req, DiagramRes.class);
        } catch (Exception e) {
            log.error("❌ [LlmClient] 초기 생성 통신 에러: ", e);
            throw new RuntimeException("AI 다이어그램 생성 실패", e);
        }
    }

    // [기능 3] 다이어그램 수정 요청
    public DiagramRes requestModifyDiagram(String sessionId, DiagramRes currentDiagram, String instruction) {
        String url = getBaseUrl() + "/projects/modify-diagram";
        log.info("▶ [LlmClient] AI 서버로 다이어그램 수정 요청. sessionId={}", sessionId);

        DiagramModifyReq modifyReq = DiagramModifyReq.builder()
                .sessionId(sessionId)
                .currentDiagram(currentDiagram)
                .instruction(instruction)
                .build();
        try {
            return restTemplate.postForObject(url, modifyReq, DiagramRes.class);
        } catch (Exception e) {
            log.error("❌ [LlmClient] 수정 통신 에러: ", e);
            throw new RuntimeException("AI 다이어그램 수정 실패", e);
        }
    }

    // [기능 4] 다이어그램 및 대화 히스토리 되돌리기 (Undo)
    public DiagramRes requestUndoDiagram(String sessionId) {
        String url = getBaseUrl() + "/projects/undo-diagram/" + sessionId;
        log.info("▶ [LlmClient] AI 서버로 Undo 요청. sessionId={}", sessionId);
        try {
            return restTemplate.postForObject(url, null, DiagramRes.class);
        } catch (Exception e) {
            log.error("❌ [LlmClient] Undo 통신 에러: ", e);
            throw new RuntimeException("AI 다이어그램 되돌리기 실패", e);
        }
    }

    // [기능 4-2] 세션 초기화 (Clear)
    public void requestResetChat(String sessionId) {
        String url = getBaseUrl() + "/chat/" + sessionId;
        log.info("▶ [LlmClient] AI 서버 세션 삭제 요청. sessionId={}", sessionId);
        try {
            restTemplate.delete(url);
        } catch (Exception e) {
            log.error("❌ [LlmClient] 세션 삭제 통신 에러: ", e);
        }
    }

    // [기능 5-1] 1단계: 프로젝트 파일 트리 구조 생성
    public FileStructureRes requestFileTree(DiagramRes diagram, String targetFramework) {
        String url = getBaseUrl() + "/projects/generate-file-tree";
        log.info("▶ [LlmClient] AI 서버로 파일 트리 구조 생성 요청. framework={}", targetFramework);

        FileTreeReq treeReq = FileTreeReq.builder()
                .diagram(diagram)
                .targetFramework(targetFramework)
                .build();
        try {
            return restTemplate.postForObject(url, treeReq, FileStructureRes.class);
        } catch (Exception e) {
            log.error("❌ [LlmClient] 파일 트리 생성 에러: ", e);
            throw new RuntimeException("프로젝트 파일 구조 생성 실패", e);
        }
    }

    // [기능 5-2] 2단계: 특정 단일 파일 코드 생성
    public SingleCodeRes requestSingleCode(DiagramRes diagram, String targetFramework, String targetFilePath) {
        String url = getBaseUrl() + "/projects/generate-single-code";
        log.info("▶ [LlmClient] AI 서버로 코드 생성 요청. filePath={}", targetFilePath);

        SingleCodeReq codeReq = SingleCodeReq.builder()
                .diagram(diagram)
                .targetFramework(targetFramework)
                .targetFilePath(targetFilePath)
                .build();
        try {
            return restTemplate.postForObject(url, codeReq, SingleCodeRes.class);
        } catch (Exception e) {
            log.error("❌ [LlmClient] 소스 코드 생성 에러: ", e);
            throw new RuntimeException("소스 코드 생성 실패", e);
        }
    }
}
