package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.PartyDtos.InviteReq;
import com.capstone.collaborationhelper.dto.PartyDtos.Res;
import com.capstone.collaborationhelper.dto.PartyDtos.UpdateRoleReq;
import com.capstone.collaborationhelper.service.PartyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "프로젝트 멤버(Party) 관리", description = "프로젝트 참여자 초대, 권한 변경, 탈퇴 및 강퇴 관리")
@RestController
@RequestMapping("/api/projects/{projectId}/members")
@RequiredArgsConstructor
public class PartyController {

    private final PartyService partyService;

    @Operation(summary = "멤버 목록 조회", description = "해당 프로젝트에 참여 중인 모든 유저와 그들의 역할(Owner, Member, Guest)을 조회합니다.")
    @GetMapping
    public ResponseEntity<List<Res>> getMembers(@PathVariable Integer projectId) {
        return ResponseEntity.ok(partyService.getMembersByProject(projectId));
    }

    @Operation(summary = "멤버 초대", description = "이메일 또는 아이디를 통해 새로운 유저를 프로젝트에 참여시킵니다.")
    @PostMapping
    public ResponseEntity<Res> inviteMember(
            @PathVariable Integer projectId,
            @Valid @RequestBody InviteReq req) {
        return ResponseEntity.ok(partyService.inviteMember(projectId, req));
    }

    @Operation(summary = "멤버 권한 수정", description = "특정 멤버의 역할을 변경합니다. (Owner 권한 필요)")
    @PatchMapping("/{userId}")
    public ResponseEntity<Res> updateRole(
            @PathVariable Integer projectId,
            @PathVariable Integer userId,
            @Valid @RequestBody UpdateRoleReq req) {
        return ResponseEntity.ok(partyService.updateMemberRole(projectId, userId, req));
    }

    @Operation(summary = "멤버 내보내기/탈퇴", description = "프로젝트에서 멤버를 제거합니다. 본인이 요청하면 탈퇴, 관리자가 요청하면 강퇴가 됩니다.")
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable Integer projectId,
            @PathVariable Integer userId) {
        partyService.removeMember(projectId, userId);
        return ResponseEntity.noContent().build();
    }
}