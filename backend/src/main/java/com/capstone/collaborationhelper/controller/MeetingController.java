package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.ChatDtos.AgentRes;
import com.capstone.collaborationhelper.service.MeetingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    // 회의 음성 업로드 → AI 다이어그램 수정 제안만 반환. DB 반영은 POST /chat/agent/agree.
    @PostMapping(value = "/{projectId}/meeting-audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AgentRes> processMeetingAudio(
            @PathVariable Integer projectId,
            @RequestParam("file") MultipartFile file) {

        log.info("회의 음성 처리 요청 수신 - 프로젝트 ID: {}, 파일명: {}", projectId, file.getOriginalFilename());

        AgentRes result = meetingService.processAudioAndUpdateDiagram(projectId, file);
        return ResponseEntity.ok(result);
    }
}
