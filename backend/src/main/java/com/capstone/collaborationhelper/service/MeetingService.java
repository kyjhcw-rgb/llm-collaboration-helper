package com.capstone.collaborationhelper.service;

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
    private final CrdtService crdtService; // 기존 DB / CRDT 상태 관리 서비스

    @Value("${ai.fastapi.url:http://localhost:1234}")
    private String fastapiBaseUrl;

    public JsonNode processAudioAndUpdateDiagram(Integer projectId, MultipartFile file) {
        try {
            // 1. 백엔드 DB/CRDT에서 현재 최신 다이어그램 스냅샷 조회
            Object currentDiagramObj = crdtService.getCurrentDiagram(projectId);
            String currentDiagramJson = objectMapper.writeValueAsString(currentDiagramObj);

            // 2. FastAPI로 전달할 Multipart 요청 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            // 3. Multipart Body 구성 (FastAPI main.py Form 파라미터명과 매칭)
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("sessionId", "session_project_" + projectId);
            body.add("currentDiagram", currentDiagramJson);

            // RestTemplate에서 파일명이 손실되지 않도록 ByteArrayResource 재정의
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
            log.info("FastAPI AI 서버 호출 시작: {}", targetUrl);

            ResponseEntity<JsonNode> response = restTemplate.postForEntity(targetUrl, requestEntity, JsonNode.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseBody = response.getBody();
                
                // FastAPI 응답 구조: { "reply": "변경 요약문...", "diagram": { ... } }
                JsonNode updatedDiagram = responseBody.get("diagram");

                if (updatedDiagram != null && !updatedDiagram.isNull()) {
                    // 5. AI가 수정한 다이어그램을 DB 및 CRDT 스냅샷으로 최신화 저장
                    crdtService.saveDiagramSnapshot(projectId, updatedDiagram);
                    log.info("프로젝트 [{}] 최신 다이어그램 DB/CRDT 저장 성공", projectId);
                } else {
                    log.warn("FastAPI 응답 내 'diagram' 필드가 존재하지 않거나 빈 값입니다.");
                }

                return responseBody;
            } else {
                throw new RuntimeException("FastAPI AI 서버 응답 에러 Status: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("회의 음성 처리 및 AI 연동 중 오류 발생 (ProjectId: {})", projectId, e);
            throw new RuntimeException("회의 음성 분석 처리 실패: " + e.getMessage(), e);
        }
    }
}
