package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.dto.ChatDtos.ChatReq;
import com.capstone.collaborationhelper.dto.ChatDtos.MessageRes;
import com.capstone.collaborationhelper.service.ChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "프로젝트 챗봇", description = "프로젝트 다이어그램 기반 AI Ask / Agent")
@RestController
@RequestMapping("/api/projects/{projectId}/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @Operation(summary = "챗봇 대화 목록", description = "현재 사용자의 이 프로젝트 챗봇 대화 기록을 시간순으로 반환합니다.")
    @GetMapping("/messages")
    public ResponseEntity<List<MessageRes>> getMessages(@PathVariable Integer projectId) {
        return ResponseEntity.ok(chatService.getMessages(projectId));
    }

    @Operation(summary = "Ask 모드", description = "비동기로 요청하며 완료 시 WebSocket(AI_RESPONSE_READY)으로 결과를 받습니다.")
    @PostMapping("/ask")
    public ResponseEntity<?> chat(
            @PathVariable Integer projectId,
            @Valid @RequestBody ChatReq req) {
        chatService.chatAsync(projectId, req);
        return ResponseEntity.accepted().body(Map.of("message", "Ask 요청이 접수되었습니다. 완료 시 웹소켓 알림이 전송됩니다."));
    }

    @Operation(summary = "Agent 모드", description = "비동기로 수정 제안 요청하며 완료 시 WebSocket(AI_RESPONSE_READY)으로 결과를 받습니다.")
    @PostMapping("/agent")
    public ResponseEntity<?> agent(
            @PathVariable Integer projectId,
            @Valid @RequestBody ChatReq req) {
        chatService.agentAsync(projectId, req);
        return ResponseEntity.accepted().body(Map.of("message", "Agent 제안 생성 요청이 접수되었습니다. 완료 시 웹소켓 알림이 전송됩니다."));
    }

    @Operation(summary = "Agent 제안 확정", description = "blocks/edges를 받아 라이브 캔버스 DB에 반영합니다.")
    @PostMapping("/agent/agree")
    public ResponseEntity<Map<String, String>> agree(
            @PathVariable Integer projectId,
            @RequestBody CanvasDtos.SyncReq req) {
        chatService.agree(projectId, req);
        return ResponseEntity.ok(Map.of("message", "Agent 제안이 캔버스에 반영되었습니다."));
    }
}