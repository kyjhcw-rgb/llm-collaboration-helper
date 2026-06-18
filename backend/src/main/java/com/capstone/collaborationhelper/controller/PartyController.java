package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.PartyDtos;
import com.capstone.collaborationhelper.service.PartyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects/{projectId}/members")
@RequiredArgsConstructor
public class PartyController {

    private final PartyService partyService;

    // 1. 프로젝트 멤버 목록 및 권한 조회 (프론트엔드 CanvasPage 진입 시 호출됨)
    @GetMapping
    public ResponseEntity<List<PartyDtos.Res>> getMembers(@PathVariable Integer projectId) {
        return ResponseEntity.ok(partyService.getMembersByProject(projectId));
    }

    // 2. 새로운 멤버 초대 (OWNER 전용)
    @PostMapping("/invite")
    public ResponseEntity<PartyDtos.Res> inviteMember(
            @PathVariable Integer projectId,
            @RequestBody PartyDtos.InviteReq req) {
        return ResponseEntity.ok(partyService.inviteMember(projectId, req));
    }

    // 3. 멤버 권한(Role) 수정 (OWNER 전용)
    @PatchMapping("/{userId}/role")
    public ResponseEntity<PartyDtos.Res> updateMemberRole(
            @PathVariable Integer projectId,
            @PathVariable Integer userId,
            @RequestBody PartyDtos.UpdateRoleReq req) {
        return ResponseEntity.ok(partyService.updateMemberRole(projectId, userId, req));
    }

    // 4. 멤버 내보내기(OWNER) 또는 자진 탈퇴(본인)
    @DeleteMapping("/{userId}")
    public ResponseEntity<?> removeMember(
            @PathVariable Integer projectId,
            @PathVariable Integer userId) {
        partyService.removeMember(projectId, userId);
        return ResponseEntity.ok(Map.of("message", "멤버가 성공적으로 제외되었습니다."));
    }
}