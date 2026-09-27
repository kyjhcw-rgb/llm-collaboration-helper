package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.ProjectDtos.MeetingDescriptionRes;
import com.capstone.collaborationhelper.service.MeetingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService meetingService;

    // 회의 음성 업로드 → 202 접수. 제안은 WebSocket(AI_RESPONSE_READY, mode=AGENT)으로 전달, DB 반영은 POST /chat/agent/agree.
    @PostMapping(value = "/{projectId}/meeting-audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> processMeetingAudio(
            @PathVariable Integer projectId,
            @RequestParam("file") MultipartFile file) {

        log.info("회의 음성 처리 요청 수신 - 프로젝트 ID: {}, 파일명: {}", projectId, file.getOriginalFilename());

        meetingService.processAudioAsync(projectId, file);
        return ResponseEntity.accepted().body(Map.of("message", "회의 음성 분석 요청이 접수되었습니다. 완료 시 웹소켓 알림이 전송됩니다."));
    }

    // 프로젝트 생성 페이지용: 초기 설계 회의 음성 → 설명란에 넣을 프로젝트 설명 (동기)
    @PostMapping(value = "/meeting-description", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MeetingDescriptionRes> describeProject(@RequestParam("file") MultipartFile file) {
        log.info("회의 기반 프로젝트 설명 요청 수신 - 파일명: {}", file.getOriginalFilename());
        return ResponseEntity.ok(new MeetingDescriptionRes(meetingService.describeProject(file)));
    }
}
