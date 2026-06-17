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
import lombok.extern.slf4j.Slf4j; // 💡 디버깅 로그용 어노테이션 추가
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j // 
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
                .map(Party::getProject)
                .collect(Collectors.toMap(
                        Project::getId,
                        p -> p,
                        (a, b) -> a,
                        LinkedHashMap::new))
                .values().stream()
                .sorted(Comparator.comparing(Project::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(Res::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public Res getById(Integer id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("프로젝트를 찾을 수 없습니다."));
        assertPartyMember(project);
        return Res.from(project);
    }

    @Transactional
    public Res create(CreateReq req) {
        log.info("▶ [ProjectService] 새 프로젝트 생성을 시작합니다. 제목: {}", req.getTitle());
        
        // 1. 기존의 프로젝트 소유자 및 기본 정보 빌드 (최초 버전은 임시로 1로 지정)
        User owner = currentUser();
        Project project = Project.builder()
                .owner(owner)
                .title(req.getTitle().trim())
                .framework(req.getFramework())
                .freedomLevel(req.getFreedomLevel())
                .descriptionPrompt(req.getDescriptionPrompt())
                .build();
        
        // 2. 프로젝트 기본 정보 DB 저장
        projectRepository.save(project);
        
        // 3. 기존의 프로젝트 멤버(소유자) 관계 저장
        partyRepository.save(Party.builder()
                .project(project)
                .user(owner)
                .role(ROLE_OWNER)
                .build());

        // 4. FastAPI AI 서버와 통신하여 초기 다이어그램 설계도 받아오기
        try {
            log.info("▶ [ProjectService] LlmClient를 통해 AI 다이어그램 생성을 요청합니다.");
            DiagramRes diagram = llmClient.requestInitialDiagram(req);

            if (diagram != null) {
                translationService.importToDb(project.getId(), diagram);
                canvasService.commitVersion(project.getId(), "초기 AI 다이어그램 생성");

                log.info("✔ [ProjectService] AI 다이어그램이 포함된 프로젝트 생성이 최종 완료되었습니다. 프로젝트 ID: {}", project.getId());
            }
        } catch (Exception e) {
            log.error("❌ [ProjectService] AI 초기 다이어그램 생성 및 연동 실패: ", e);
            // 💡 런타임 예외를 의도적으로 터트려 앞서 저장된 Project와 Party까지 안전하게 원상복구(Rollback) 시킵니다.
            throw new RuntimeException("초기 아키텍처 다이어그램 생성에 실패하여 프로젝트 생성이 취소되었습니다.", e);
        }

        return Res.from(project);
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

        // [수정] req.getVersion()을 통한 업데이트 로직 제거됨 (버전 관리는 Project_Version이 전담)

        return Res.from(project);
    }

    @Transactional
    public void delete(Integer id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("프로젝트를 찾을 수 없습니다."));
        assertOwner(project);
        partyRepository.deleteByProject(project);
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
