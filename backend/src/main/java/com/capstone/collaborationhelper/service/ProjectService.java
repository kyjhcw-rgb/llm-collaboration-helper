package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.client.LlmClient;
import com.capstone.collaborationhelper.dto.ProjectDtos.CreateReq;
import com.capstone.collaborationhelper.dto.ProjectDtos.Res;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.capstone.collaborationhelper.dto.ProjectDtos.UpdateReq;
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

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectService {

    public static final String ROLE_OWNER = "OWNER";

    private final ProjectRepository projectRepository;
    private final PartyRepository partyRepository;
    private final UserRepository userRepository;

    private final CanvasService canvasService;
    private final TranslationService translationService;
    private final LlmClient llmClient;

    @Transactional(readOnly = true)
    public List<Res> getlist() {
        User me = currentUser();

        return partyRepository.findByUser(me).stream()
                // 1. 프로젝트 최신 수정일 기준 정렬
                .sorted(Comparator.comparing(
                        (Party party) -> party.getProject().getUpdatedAt(),
                        Comparator.nullsLast(Comparator.naturalOrder())
                ).reversed())
                // 2. 새로 만든 팩토리 메서드를 사용하여 Project와 Role을 한 번에 결합
                .map(party -> Res.from(party.getProject(), party.getRole()))
                .toList();
    }
    
    @Transactional(readOnly = true)
    public Res getById(Integer id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("프로젝트를 찾을 수 없습니다."));

        // 권한 충돌 방지: 단건 조회 시에도 조회하려는 유저의 정확한 Role 정보를 함께 실어 보냄
        User me = currentUser();
        Party myParty = partyRepository.findByProjectAndUser(project, me)
                .orElseThrow(() -> new RuntimeException("이 프로젝트에 접근할 권한이 없습니다."));

        return Res.from(project, myParty.getRole());
    }

    @Transactional
    public Res create(CreateReq req) {
        log.info("▶ [ProjectService] 새 프로젝트 생성을 시작합니다. 제목: {}", req.getTitle());

        User owner = currentUser();
        Project project = Project.builder()
                .owner(owner)
                .title(req.getTitle().trim())
                .framework(req.getFramework())
                .freedomLevel(req.getFreedomLevel())
                .descriptionPrompt(req.getDescriptionPrompt())
                .build();

        projectRepository.save(project);

        partyRepository.save(Party.builder()
                .project(project)
                .user(owner)
                .role(ROLE_OWNER)
                .build());

        /*try {
            log.info("▶ [ProjectService] LlmClient를 통해 AI 다이어그램 생성을 요청합니다.");
            DiagramRes diagram = llmClient.requestInitialDiagram(req);

            if (diagram != null) {
                translationService.importToDb(project.getId(), diagram);
                canvasService.commitVersion(project.getId(), "초기 AI 다이어그램 생성");

                log.info("✔ [ProjectService] AI 다이어그램이 포함된 프로젝트 생성이 최종 완료되었습니다. 프로젝트 ID: {}", project.getId());
            }
        } catch (Exception e) {
            log.error("❌ [ProjectService] AI 초기 다이어그램 생성 및 연동 실패: ", e);
            throw new RuntimeException("초기 아키텍처 다이어그램 생성에 실패하여 프로젝트 생성이 취소되었습니다.", e);
        }*/

        return Res.from(project, ROLE_OWNER);
    }

    @Transactional
    public Res update(Integer id, UpdateReq req) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("프로젝트를 찾을 수 없습니다."));

        assertOwner(project);

        if (req.getTitle() != null && !req.getTitle().isBlank()) {
            project.setTitle(req.getTitle().trim());
        }
        if (req.getFramework() != null) {
            project.setFramework(req.getFramework());
        }
        if (req.getFreedomLevel() != null) {
            project.setFreedomLevel(req.getFreedomLevel());
        }
        if (req.getDescriptionPrompt() != null) {
            project.setDescriptionPrompt(req.getDescriptionPrompt());
        }
        if (req.getDiagramState() != null) {
            project.setDiagramState(req.getDiagramState());
        }

        // 업데이트 이후 프론트엔드 갱신 데이터에서 권한이 날아가지 않도록 기존 Role을 재조회하여 함께 응답
        User me = currentUser();
        Party myParty = partyRepository.findByProjectAndUser(project, me)
                .orElseThrow(() -> new RuntimeException("이 프로젝트에 접근할 권한이 없습니다."));

        return Res.from(project, myParty.getRole());
    }

    @Transactional
    public void delete(Integer id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("프로젝트를 찾을 수 없습니다."));

        assertOwner(project);

        // [해결] DB 스키마에 ON DELETE CASCADE 제약 조건이 걸려 있으므로 부모만 삭제하면 됨
        // 영속성 컨텍스트 쓰기 지연과 벌크 연산 간의 타이밍 꼬임 현상을 막기 위해 기존의 partyRepository.deleteByProject 코드를 완전히 삭제
        projectRepository.delete(project);
    }

    private void assertPartyMember(Project project) {
        User me = currentUser();
        if (partyRepository.findByProjectAndUser(project, me).isEmpty()) {
            throw new RuntimeException("이 프로젝트에 접근할 권한이 없습니다.");
        }
    }

    private void assertOwner(Project project) {
        User me = currentUser();
        Party myParty = partyRepository.findByProjectAndUser(project, me)
                .orElseThrow(() -> new RuntimeException("이 프로젝트에 접근할 권한이 없습니다."));

        if (!ROLE_OWNER.equals(myParty.getRole())) {
            throw new RuntimeException("프로젝트 소유자(OWNER)만 이 작업을 할 수 있습니다.");
        }
    }

    private User currentUser() {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("로그인 사용자를 찾을 수 없습니다."));
    }
}