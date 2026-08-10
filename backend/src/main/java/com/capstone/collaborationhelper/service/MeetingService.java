package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper;
    private final CanvasService canvasService; // CrdtService 대신 CanvasService 주입

    @Value("${ai.fastapi.url:http://localhost:1234}")
    private String fastapiBaseUrl;

    public JsonNode processAudioAndUpdateDiagram(Integer projectId, MultipartFile file) {
        try {
            // 1. CrdtService 대신 CanvasService에서 라이브 다이어그램 데이터(SyncRes) 조회
            CanvasDtos.SyncRes currentCanvas = canvasService.loadLiveCanvas(projectId);
            String currentDiagramJson = objectMapper.writeValueAsString(currentCanvas);

            // 2. FastAPI 전달용 Multipart 요청 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            // 3. Multipart Body 구성
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("sessionId", "session_project_" + projectId);
            body.add("currentDiagram", currentDiagramJson);

            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename() != null ? file.getOriginalFilename() : "meeting_audio.webm";
                }
            };
            body.add("file", fileResource);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            // 4. FastAPI AI 서버 호출 (/projects/process-meeting-audio)
            String targetUrl = fastapiBaseUrl + "/projects/process-meeting-audio";
            log.info("FastAPI AI 서버 호출: {}", targetUrl);

            ResponseEntity<JsonNode> response = restTemplate.postForEntity(targetUrl, requestEntity, JsonNode.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseBody = response.getBody();

                // FastAPI 응답 구조: { "reply": "...", "diagram": { "blocks": [...], "edges": [...] } }
                JsonNode updatedDiagramNode = responseBody.get("diagram");

                if (updatedDiagramNode != null && !updatedDiagramNode.isNull()) {
                    // 5. FastAPI가 응답한 updatedDiagram을 CanvasDtos.SyncReq 객체로 변환
                    CanvasDtos.SyncReq syncReq = objectMapper.treeToValue(updatedDiagramNode, CanvasDtos.SyncReq.class);

                    // 6. CanvasService.syncLiveCanvas를 호출하여 DB 및 Canvas 상태 동기화
                    canvasService.syncLiveCanvas(projectId, syncReq);
                    log.info("프로젝트 [{}] Canvas 다이어그램 반영 완료", projectId);
                } else {
                    log.warn("FastAPI 응답 내 'diagram' 필드가 null입니다.");
                }

                return responseBody;
            } else {
                throw new RuntimeException("FastAPI 서버 응답 실패 Status: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("회의 음성 처리 및 다이어그램 연동 오류 (ProjectId: {})", projectId, e);
            throw new RuntimeException("회의 음성 분석 처리 실패: " + e.getMessage(), e);
        }
    }
}
