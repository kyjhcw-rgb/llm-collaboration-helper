package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.client.LlmClient;
import com.capstone.collaborationhelper.code2diagram.CodeToDiagramService;
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
import jakarta.persistence.EntityManager;
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
    private final CodeToDiagramService codeToDiagramService;

    // 추가: DB 제약조건 오류를 우회하여 초고속 벌크 삭제를 수행하기 위한 의존성 주입
    private final EntityManager entityManager;

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

        try {
            InitialDiagram initial = resolveInitialDiagram(req);
            if (initial == null) {
                log.info("✔ [ProjectService] 초기 다이어그램 없이 빈 프로젝트를 생성합니다. 프로젝트 ID: {}", project.getId());
                return Res.from(project, ROLE_OWNER);
            }

            translationService.importToDb(project.getId(), initial.diagram());
            canvasService.commitVersion(project.getId(), initial.commitMessage());
            log.info("✔ [ProjectService] 초기 다이어그램이 포함된 프로젝트 생성 완료. 프로젝트 ID: {}, source={}",
                    project.getId(), initial.source());
        } catch (Exception e) {
            log.error("❌ [ProjectService] 초기 다이어그램 생성 및 연동 실패: ", e);
            throw new RuntimeException("초기 아키텍처 다이어그램 생성에 실패하여 프로젝트 생성이 취소되었습니다.", e);
        }

        return Res.from(project, ROLE_OWNER);
    }

    /**
     * 우선순위: repoUrl(코드) &gt; descriptionPrompt(LLM) &gt; 없음(빈 프로젝트).
     */
    private InitialDiagram resolveInitialDiagram(CreateReq req) throws Exception {
        String repoUrl = req.getRepoUrl();
        if (repoUrl != null && !repoUrl.isBlank()) {
            log.info("▶ [ProjectService] GitHub 레포에서 초기 다이어그램을 생성합니다.");
            DiagramRes diagram = codeToDiagramService.fromGitHubUrl(repoUrl.trim());
            return new InitialDiagram(diagram, "code", "초기 코드 다이어그램 생성");
        }

        String prompt = req.getDescriptionPrompt();
        if (prompt != null && !prompt.isBlank()) {
            log.info("▶ [ProjectService] LlmClient를 통해 AI 다이어그램 생성을 요청합니다.");
            DiagramRes diagram = llmClient.requestInitialDiagram(req);
            if (diagram == null) {
                return null;
            }
            return new InitialDiagram(diagram, "llm", "초기 AI 다이어그램 생성");
        }

        return null;
    }

    private record InitialDiagram(DiagramRes diagram, String source, String commitMessage) {
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

        // 핵심 해결: 실제 DB에 ON DELETE CASCADE가 반영되지 않은 상태를 방어하기 위한 'JPQL 벌크 삭제'
        // JPA 캐시를 거치지 않고 DB에 직접 DELETE 쿼리를 날리므로 N+1 문제 없이 빛의 속도로 지워집니다.
        entityManager.createQuery("DELETE FROM Party p WHERE p.project.id = :id").setParameter("id", id).executeUpdate();
        entityManager.createQuery("DELETE FROM Block b WHERE b.project.id = :id").setParameter("id", id).executeUpdate();
        entityManager.createQuery("DELETE FROM Edge e WHERE e.project.id = :id").setParameter("id", id).executeUpdate();
        entityManager.createQuery("DELETE FROM ProjectCrdtLog c WHERE c.project.id = :id").setParameter("id", id).executeUpdate();
        entityManager.createQuery("DELETE FROM ProjectVersion v WHERE v.project.id = :id").setParameter("id", id).executeUpdate();

        // (※ 만약 다른 자식 테이블을 추가로 생성하면 똑같이 한 줄 추가하면됨)

        // 자식 데이터가 모두 깔끔하게 지워졌으므로 이제 안전하게 부모(Project)를 삭제
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