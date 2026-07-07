package com.capstone.collaborationhelper.controller;

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

@Tag(name = "프로젝트 챗봇", description = "프로젝트 다이어그램 기반 AI Q&A")
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

    @Operation(summary = "챗봇 질문", description = "현재 프로젝트의 라이브 다이어그램과 기획 설명을 바탕으로 AI에게 질문합니다.")
    @PostMapping
    public ResponseEntity<ChatRes> chat(
            @PathVariable Integer projectId,
            @Valid @RequestBody ChatReq req) {
        return ResponseEntity.ok(chatService.chat(projectId, req));
    }
}
