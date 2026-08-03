package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.CommentDtos.*;
import com.capstone.collaborationhelper.service.BlockCommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects/{projectId}/blocks/{blockFrontendId}/comments")
@RequiredArgsConstructor
public class BlockCommentController {

    private final BlockCommentService commentService;

    @GetMapping
    public ResponseEntity<List<Res>> getComments(
            @PathVariable Integer projectId,
            @PathVariable String blockFrontendId) {
        return ResponseEntity.ok(commentService.getComments(projectId, blockFrontendId));
    }

    @PostMapping
    public ResponseEntity<Res> createComment(
            @PathVariable Integer projectId,
            @PathVariable String blockFrontendId,
            @RequestBody Req req) {
        return ResponseEntity.ok(commentService.createComment(projectId, blockFrontendId, req));
    }

    @PutMapping("/{commentId}")
    public ResponseEntity<Res> updateComment(
            @PathVariable Integer projectId,
            @PathVariable String blockFrontendId,
            @PathVariable Integer commentId,
            @RequestBody Req req) {
        return ResponseEntity.ok(commentService.updateComment(projectId, commentId, req));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<?> deleteComment(
            @PathVariable Integer projectId,
            @PathVariable String blockFrontendId,
            @PathVariable Integer commentId) {
        commentService.deleteComment(projectId, commentId);
        return ResponseEntity.ok(Map.of("message", "댓글이 삭제되었습니다."));
    }
}