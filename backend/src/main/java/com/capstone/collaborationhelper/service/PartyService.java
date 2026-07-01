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
    private final EmailService emailService;

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

        // Party 테이블을 기준으로 소유자(OWNER) 권한 체크
        assertOwner(project);

        // 방어 코드 추가: 초대할 때는 최고 권한인 OWNER 역할을 타인에게 부여할 수 없도록 격리
        if ("OWNER".equalsIgnoreCase(req.getRole())) {
            throw new RuntimeException("초대 시 OWNER 권한을 새 멤버에게 직접 부여할 수 없습니다.");
        }

        User inviter = currentUser(); // 나(OWNER)의 정보 가져오기 가져오기

        User targetUser = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new RuntimeException("초대하려는 유저를 찾을 수 없습니다."));

        if (partyRepository.findByProjectAndUser(project, targetUser).isPresent()) {
            throw new RuntimeException("이미 프로젝트에 참여 중인 유저입니다.");
        }

        Party newParty = Party.builder()
                .project(project)
                .user(targetUser)
                .role(req.getRole()) // MEMBER, GUEST 등
                .build();

        Party savedParty = partyRepository.save(newParty);
        log.info("▶ [PartyService] 프로젝트(ID: {})에 유저({})를 {} 역할로 초대합니다.", projectId, targetUser.getEmail(), req.getRole());

        // DB 저장 완료 후 초대 메일 발송
        try {
            emailService.sendProjectInvitationEmail(
                    targetUser.getEmail(),
                    project.getTitle(),
                    inviter.getNickname(),
                    req.getRole()
            );
        } catch (Exception e) {
            // 메일 전송에 실패하더라도 초대(DB 저장) 자체를 롤백시키지 않음
            log.error("초대 메일 발송 실패 (초대는 정상 완료됨): {}", e.getMessage());
        }

        return Res.from(savedParty);
    }

    /**
     * 멤버 역할(Role) 수정
     */
    @Transactional
    public Res updateMemberRole(Integer projectId, Integer userId, UpdateRoleReq req) {
        Project project = findProjectById(projectId);
        assertOwner(project); // 방장(OWNER)만 변경 가능

        Party targetParty = partyRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new RuntimeException("해당 프로젝트의 멤버가 아닙니다."));

        if ("OWNER".equals(targetParty.getRole())) {
            throw new RuntimeException("소유자의 권한은 변경할 수 없습니다.");
        }

        // 방어 코드 추가: 역할 수정 단에서도 타 멤버를 OWNER 권한으로 임명하는 것을 원천 차단
        if ("OWNER".equalsIgnoreCase(req.getRole())) {
            throw new RuntimeException("다른 멤버를 다중 소유자(OWNER)로 격상시킬 수 없습니다.");
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

        // 내 참여 정보와 대상의 참여 정보를 Party 테이블에서 조회
        Party myParty = partyRepository.findByProjectAndUser(project, me)
                .orElseThrow(() -> new RuntimeException("접근 권한이 없습니다."));

        Party targetParty = partyRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new RuntimeException("삭제할 멤버 정보를 찾을 수 없습니다."));

        // Party 테이블의 권한(Role)을 기준으로 로직 처리
        boolean isSelfExit = me.getId().equals(userId);
        boolean isOwnerKicking = "OWNER".equals(myParty.getRole());

        if (!isSelfExit && !isOwnerKicking) {
            throw new RuntimeException("멤버를 삭제할 권한이 없습니다.");
        }

        if (isSelfExit && "OWNER".equals(myParty.getRole())) {
            throw new RuntimeException("소유자는 프로젝트를 탈퇴할 수 없습니다. 프로젝트를 삭제해주세요.");
        }

        partyRepository.delete(targetParty);
        log.info("▶ [PartyService] 프로젝트(ID: {})에서 유저(ID: {})가 제거되었습니다.", projectId, userId);
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