package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.service.MeetingService;
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler.ForceReloadEvent;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService meetingService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 회의 음성 업로드 및 AI 다이어그램 자동 수정 API
     * POST /api/projects/{projectId}/meeting-audio
     */
    @PostMapping(value = "/{projectId}/meeting-audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<JsonNode> processMeetingAudio(
            @PathVariable Integer projectId,
            @RequestParam("file") MultipartFile file) {

        log.info("회의 음성 처리 요청 수신 - 프로젝트 ID: {}, 파일명: {}", projectId, file.getOriginalFilename());

        // 1. FastAPI AI 서버 호출 -> STT + Gemini 처리 후 수정된 다이어그램 및 reply 받아오기
        JsonNode result = meetingService.processAudioAndUpdateDiagram(projectId, file);

        // 2. 작성해둔 CrdtWebSocketHandler로 FORCE_RELOAD 이벤트 발행 (접속자 전원 실시간 갱신)
        eventPublisher.publishEvent(new ForceReloadEvent(projectId));
        log.info("프로젝트 [{}] FORCE_RELOAD 웹소켓 이벤트 발행 완료", projectId);

        // 3. 업로드를 진행한 유저에게도 reply(변경 요약) 및 diagram 데이터 응답
        return ResponseEntity.ok(result);
    }
}
