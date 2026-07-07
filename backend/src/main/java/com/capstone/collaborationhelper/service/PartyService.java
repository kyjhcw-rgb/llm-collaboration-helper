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
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler.KickUserEvent;
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler.RoleChangeEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PartyService {

    private final PartyRepository partyRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final ApplicationEventPublisher eventPublisher; // 순환참조 방지

    /**
     * 프로젝트 멤버 목록 조회
     */
    @Transactional(readOnly = true)
    public List<Res> getMembersByProject(Integer projectId) {
        Project project = findProjectById(projectId);
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
        assertOwner(project);

        if ("OWNER".equalsIgnoreCase(req.getRole())) throw new RuntimeException("불가");

        User targetUser = userRepository.findByEmail(req.getEmail()).orElseThrow();
        if (partyRepository.findByProjectAndUser(project, targetUser).isPresent()) throw new RuntimeException("이미 존재");

        Party savedParty = partyRepository.save(Party.builder().project(project).user(targetUser).role(req.getRole()).build());
        try { emailService.sendProjectInvitationEmail(targetUser.getEmail(), project.getTitle(), currentUser().getNickname(), req.getRole()); } catch (Exception e) {}
        return Res.from(savedParty);
    }

    /**
     * 멤버 역할(Role) 수정
     */
    @Transactional
    public Res updateMemberRole(Integer projectId, Integer userId, UpdateRoleReq req) {
        Project project = findProjectById(projectId);
        assertOwner(project);

        Party targetParty = partyRepository.findByProjectIdAndUserId(projectId, userId).orElseThrow();
        if ("OWNER".equals(targetParty.getRole()) || "OWNER".equalsIgnoreCase(req.getRole())) throw new RuntimeException("불가");

        targetParty.setRole(req.getRole());

        // [수정] 이벤트 발행
        eventPublisher.publishEvent(new RoleChangeEvent(projectId, userId, req.getRole()));

        return Res.from(targetParty);
    }

    /**
     * 멤버 내보내기 또는 자진 탈퇴
     */
    @Transactional
    public void removeMember(Integer projectId, Integer userId) {
        Project project = findProjectById(projectId);
        User me = currentUser();
        Party myParty = partyRepository.findByProjectAndUser(project, me).orElseThrow();
        Party targetParty = partyRepository.findByProjectIdAndUserId(projectId, userId).orElseThrow();

        boolean isSelfExit = me.getId().equals(userId);
        boolean isOwnerKicking = "OWNER".equals(myParty.getRole());

        if (!isSelfExit && !isOwnerKicking) throw new RuntimeException("권한 없음");
        if (isSelfExit && "OWNER".equals(myParty.getRole())) throw new RuntimeException("방장 탈퇴 불가");

        partyRepository.delete(targetParty);

        if (isOwnerKicking && !isSelfExit) {
            // [수정] 강퇴 이벤트 발행
            eventPublisher.publishEvent(new KickUserEvent(projectId, userId));
        }
    }

    // --- 공통 편의 메서드 ---

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

    // Project 엔티티의 owner_id 대신 Party 테이블의 Role을 확인
    private void assertOwner(Project project) {
        User me = currentUser();
        Party myParty = partyRepository.findByProjectAndUser(project, me)
                .orElseThrow(() -> new RuntimeException("이 프로젝트에 접근할 권한이 없습니다."));

        if (!"OWNER".equals(myParty.getRole())) {
            throw new RuntimeException("프로젝트 소유자(OWNER)만 이 작업을 할 수 있습니다.");
        }
    }

    private User currentUser() {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("로그인 사용자를 찾을 수 없습니다."));
    }
}