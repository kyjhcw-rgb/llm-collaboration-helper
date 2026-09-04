package com.capstone.collaborationhelper.client;

import com.capstone.collaborationhelper.dto.ChatDtos.LlmChatReq;
import com.capstone.collaborationhelper.dto.ChatDtos.LlmChatRes;
import com.capstone.collaborationhelper.dto.ChatDtos.LlmModifyRes;
import com.capstone.collaborationhelper.dto.ProjectDtos.CreateReq;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Component
@RequiredArgsConstructor
public class LlmClient {

    private final Environment environment;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private String getBaseUrl() {
        return environment.getProperty("app.ai-server.url").replaceAll("/$", "");
    }

    // [기능 1] 프로젝트 챗봇 요청 (/project/ask)
    public String requestProjectChat(LlmChatReq req) {
        String url = getBaseUrl() + "/project/ask";
        log.info("▶ [LlmClient] AI 서버로 프로젝트 챗봇 요청. url={}", url);

        try {
            LlmChatRes response = restTemplate.postForObject(url, req, LlmChatRes.class);
            if (response == null || response.getReply() == null || response.getReply().isBlank()) {
                throw new RuntimeException("AI 서버로부터 빈 응답을 받았습니다.");
            }
            return response.getReply();
        } catch (Exception e) {
            log.error("❌ [LlmClient] 프로젝트 챗봇 통신 중 에러: ", e);
            throw new RuntimeException("AI 챗봇 서버와의 통신에 실패했습니다.", e);
        }
    }

    // [기능 2] 초기 다이어그램 생성 요청 (/projects/initial-diagram)
    public DiagramRes requestInitialDiagram(CreateReq req) {
        String url = getBaseUrl() + "/projects/initial-diagram";
        log.info("▶ [LlmClient] AI 서버로 초기 다이어그램 생성 요청. url={}, title={}", url, req.getTitle());

        try {
            // FastAPI Pydantic 모델(DiagramRes)과 1:1 대응되는 TranslationDtos.DiagramRes로 수신
            DiagramRes response = restTemplate.postForObject(url, req, DiagramRes.class);

            if (response != null) {
                log.info("✔ [LlmClient] 다이어그램 구조 수신 완료 (Folders: {}개, Edges: {}개)",
                        response.getFolders() != null ? response.getFolders().size() : 0,
                        response.getEdges() != null ? response.getEdges().size() : 0);
            }

            return response;
        } catch (Exception e) {
            log.error("❌ [LlmClient] 다이어그램 생성 통신 에러: ", e);
            throw new RuntimeException("AI 다이어그램 생성 서버와의 통신에 실패했습니다.", e);
        }
    }

    // [기능 3] 다이어그램 수정 요청 (/project/agent)
    public LlmModifyRes requestModifyDiagram(LlmChatReq req) {
        String url = getBaseUrl() + "/project/agent";
        log.info("▶ [LlmClient] AI 서버로 다이어그램 수정 요청. url={}", url);

        try {
            LlmModifyRes response = restTemplate.postForObject(url, req, LlmModifyRes.class);
            if (response == null || response.getReply() == null || response.getReply().isBlank()) {
                throw new RuntimeException("AI 서버로부터 빈 응답을 받았습니다.");
            }
            if (response.getDiagram() == null) {
                throw new RuntimeException("AI 서버가 수정된 다이어그램을 반환하지 않았습니다.");
            }

            log.info("✔ [LlmClient] 수정 다이어그램 수신 완료 (Folders: {}개, Edges: {}개)",
                    response.getDiagram().getFolders() != null ? response.getDiagram().getFolders().size() : 0,
                    response.getDiagram().getEdges() != null ? response.getDiagram().getEdges().size() : 0);

            return response;
        } catch (Exception e) {
            log.error("❌ [LlmClient] 다이어그램 수정 통신 에러: ", e);
            throw new RuntimeException("AI 다이어그램 수정 서버와의 통신에 실패했습니다.", e);
        }
    }

    // [신규 기능] 회의 음성 처리 및 다이어그램 수정 반영 (/projects/process-meeting-audio)
    public LlmModifyRes processMeetingAudio(MultipartFile file, DiagramRes currentDiagram, String projectContext, String sessionId) {
        String url = getBaseUrl() + "/projects/process-meeting-audio";
        log.info("▶ [LlmClient] AI 서버로 회의 음성 처리 요청. url={}, fileName={}", url, file.getOriginalFilename());

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename() != null ? file.getOriginalFilename() : "meeting_audio.webm";
                }
            };
            body.add("file", fileResource);

            // TranslationDtos.DiagramRes 객체를 JSON 직렬화하여 전달
            String diagramJson = objectMapper.writeValueAsString(currentDiagram);
            body.add("currentDiagram", diagramJson);

            if (projectContext != null) body.add("projectContext", projectContext);
            if (sessionId != null) body.add("sessionId", sessionId);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            return restTemplate.postForObject(url, requestEntity, LlmModifyRes.class);

        } catch (Exception e) {
            log.error("❌ [LlmClient] 회의 음성 처리 통신 에러: ", e);
            throw new RuntimeException("AI 회의 음성 처리 서버와의 통신에 실패했습니다.", e);
        }
    }
}
