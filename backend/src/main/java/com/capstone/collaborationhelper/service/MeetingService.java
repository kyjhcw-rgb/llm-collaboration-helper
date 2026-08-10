package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.client.LlmClient;
import com.capstone.collaborationhelper.dto.ChatDtos.LlmModifyRes;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingService {

    private final LlmClient llmClient;
    private final TranslationService translationService;
    private final ObjectMapper objectMapper;

    public JsonNode processAudioAndUpdateDiagram(Integer projectId, MultipartFile file) {
        try {
            // LLM 계약은 features 트리(DiagramRes). Canvas flat이 아님.
            DiagramRes currentDiagram = translationService.exportFromDb(projectId, null);

            LlmModifyRes result = llmClient.processMeetingAudio(
                    file,
                    currentDiagram,
                    null,
                    "session_project_" + projectId
            );

            if (result == null || result.getDiagram() == null) {
                throw new RuntimeException("AI 서버가 수정된 다이어그램을 반환하지 않았습니다.");
            }

            translationService.importToDb(projectId, result.getDiagram());
            log.info("프로젝트 [{}] 회의 음성 기반 다이어그램 반영 완료", projectId);

            return objectMapper.valueToTree(result);
        } catch (RuntimeException e) {
            log.error("회의 음성 처리 및 다이어그램 연동 오류 (ProjectId: {})", projectId, e);
            throw e;
        } catch (Exception e) {
            log.error("회의 음성 처리 및 다이어그램 연동 오류 (ProjectId: {})", projectId, e);
            throw new RuntimeException("회의 음성 분석 처리 실패: " + e.getMessage(), e);
        }
    }
}
