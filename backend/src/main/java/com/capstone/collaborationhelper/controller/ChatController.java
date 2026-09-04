package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.dto.ChatDtos.AgentRes;
import com.capstone.collaborationhelper.dto.ChatDtos.ChatReq;
import com.capstone.collaborationhelper.dto.ChatDtos.ChatRes;
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

    @Operation(summary = "Ask 모드", description = "현재 프로젝트의 라이브 다이어그램과 기획 설명을 바탕으로 AI에게 질문합니다. 다이어그램은 변경되지 않습니다.")
    @PostMapping("/ask")
    public ResponseEntity<ChatRes> chat(
            @PathVariable Integer projectId,
            @Valid @RequestBody ChatReq req) {
        return ResponseEntity.ok(chatService.chat(projectId, req));
    }

    @Operation(
            summary = "Agent 모드",
            description = "수정 제안을 생성합니다. reply와 canvas 형태(blocks/edges)를 반환하며 DB에는 반영하지 않습니다. "
                    + "folders 트리는 translation mapper로 변환됩니다. 적용은 POST /agent/agree. GUEST는 사용할 수 없습니다.")
    @PostMapping("/agent")
    public ResponseEntity<AgentRes> agent(
            @PathVariable Integer projectId,
            @Valid @RequestBody ChatReq req) {
        return ResponseEntity.ok(chatService.agent(projectId, req));
    }

    @Operation(
            summary = "Agent 제안 확정",
            description = "POST /agent 응답의 blocks/edges를 그대로 보내 라이브 캔버스 DB에 반영합니다. GUEST는 사용할 수 없습니다.")
    @PostMapping("/agent/agree")
    public ResponseEntity<Map<String, String>> agree(
            @PathVariable Integer projectId,
            @RequestBody CanvasDtos.SyncReq req) {
        chatService.agree(projectId, req);
        return ResponseEntity.ok(Map.of("message", "Agent 제안이 캔버스에 반영되었습니다."));
    }
}
