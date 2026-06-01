package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.PartyDtos.InviteReq;
import com.capstone.collaborationhelper.dto.PartyDtos.Res;
import com.capstone.collaborationhelper.dto.PartyDtos.UpdateRoleReq;
import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.PartyRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PartyService {

    private final PartyRepository partyRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    /**
     * 프로젝트 멤버 목록 조회
     */
    @Transactional(readOnly = true)
    public List<Res> getMembersByProject(Integer projectId) {
        Project project = findProjectById(projectId);
        
        // 요청자가 해당 프로젝트의 멤버인지 확인 (보안)
        assertPartyMember(project);

        return partyRepository.findByProject(project).stream()
                .map(Res::from)
                .toList();
    }

    /**
     * 새로운 멤버 초대
     */
    @Transactional
    public Res inviteMember(Integer projectId, InviteReq req) {
        Project project = findProjectById(projectId);
        
        // 1. 소유자 권한 체크 (초대는 소유자만 가능하도록 설정)
        assertOwner(project);

        // 2. 초대할 대상 유저 존재 확인 (email 기반 조회 예시)
        User targetUser = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new RuntimeException("초대하려는 유저를 찾을 수 없습니다."));

        // 3. 이미 참여 중인지 확인
        if (partyRepository.findByProjectAndUser(project, targetUser).isPresent()) {
            throw new RuntimeException("이미 프로젝트에 참여 중인 유저입니다.");
        }

        // 4. Party 생성 및 저장
        Party newParty = Party.builder()
                .project(project)
                .user(targetUser)
                .role(req.getRole()) // MEMBER, GUEST 등
                .build();

        log.info("▶ [PartyService] 프로젝트(ID: {})에 유저({})를 {} 역할로 초대합니다.", projectId, targetUser.getEmail(), req.getRole());
        return Res.from(partyRepository.save(newParty));
    }

    /**
     * 멤버 역할(Role) 수정
     */
    @Transactional
    public Res updateMemberRole(Integer projectId, Integer userId, UpdateRoleReq req) {
        Project project = findProjectById(projectId);
        assertOwner(project);

        Party targetParty = partyRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new RuntimeException("해당 프로젝트의 멤버가 아닙니다."));

        // OWNER의 역할은 함부로 바꿀 수 없도록 방어 로직 (필요시)
        if ("OWNER".equals(targetParty.getRole())) {
            throw new RuntimeException("소유자의 권한은 변경할 수 없습니다.");
        }

        targetParty.setRole(req.getRole());
        return Res.from(targetParty);
    }

    /**
     * 멤버 내보내기 또는 자진 탈퇴
     */
    @Transactional
    public void removeMember(Integer projectId, Integer userId) {
        Project project = findProjectById(projectId);
        User me = currentUser();
        
        Party targetParty = partyRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new RuntimeException("멤버 정보를 찾을 수 없습니다."));

        // 권한 체크: 
        // 1. 본인이 본인을 삭제(탈퇴) 하거나
        // 2. 프로젝트 소유자가 타인을 삭제(강퇴) 하거나
        boolean isSelfExit = me.getId().equals(userId);
        boolean isOwnerKicking = project.getOwner().getId().equals(me.getId());

        if (!isSelfExit && !isOwnerKicking) {
            throw new RuntimeException("멤버를 삭제할 권한이 없습니다.");
        }

        // 소유자 본인은 탈퇴할 수 없음 (프로젝트 삭제를 이용해야 함)
        if (isSelfExit && project.getOwner().getId().equals(me.getId())) {
            throw new RuntimeException("소유자는 프로젝트를 탈퇴할 수 없습니다. 프로젝트를 삭제해주세요.");
        }

        partyRepository.delete(targetParty);
        log.info("▶ [PartyService] 프로젝트(ID: {})에서 유저(ID: {})가 제거되었습니다.", projectId, userId);
    }

    // --- 공통 편의 메서드 (ProjectService의 것과 동일한 로직) ---

    private Project findProjectById(Integer projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("프로젝트를 찾을 수 없습니다."));
    }

    private void assertPartyMember(Project project) {
        User me = currentUser();
        if (partyRepository.findByProjectAndUser(project, me).isEmpty()) {
            throw new RuntimeException("이 프로젝트에 접근할 권한이 없습니다.");
        }
    }

    private void assertOwner(Project project) {
        User me = currentUser();
        if (!project.getOwner().getId().equals(me.getId())) {
            throw new RuntimeException("프로젝트 소유자만 이 작업을 할 수 있습니다.");
        }
    }

    private User currentUser() {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("로그인 사용자를 찾을 수 없습니다."));
    }
}