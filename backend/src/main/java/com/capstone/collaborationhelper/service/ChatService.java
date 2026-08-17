package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.client.LlmClient;
import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.dto.ChatDtos.AgentRes;
import com.capstone.collaborationhelper.dto.ChatDtos.ChatReq;
import com.capstone.collaborationhelper.dto.ChatDtos.ChatRes;
import com.capstone.collaborationhelper.dto.ChatDtos.HistoryTurn;
import com.capstone.collaborationhelper.dto.ChatDtos.LlmChatReq;
import com.capstone.collaborationhelper.dto.ChatDtos.LlmModifyRes;
import com.capstone.collaborationhelper.dto.ChatDtos.MessageRes;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.ProjectChatMessage;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.PartyRepository;
import com.capstone.collaborationhelper.repository.ProjectChatMessageRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    public static final String SENDER_USER = "USER";
    public static final String SENDER_ASSISTANT = "ASSISTANT";

    public static final String MODE_ASK = "ASK";
    public static final String MODE_AGENT = "AGENT";

    private final TranslationService translationService;
    private final CanvasService canvasService;
    private final LlmClient llmClient;
    private final ProjectChatMessageRepository chatMessageRepository;
    private final ProjectRepository projectRepository;
    private final PartyRepository partyRepository;
    private final UserRepository userRepository;
    private final TransactionTemplate transactionTemplate;

    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<MessageRes> getMessages(Integer projectId) {
        User user = currentUser();
        assertPartyMember(projectId, user);
        return findMessages(projectId, user.getId()).stream()
                .map(this::toMessageRes)
                .toList();
    }

    /** LLM 호출은 트랜잭션 밖 — DB 커넥션을 붙잡지 않음 */
    public ChatRes chat(Integer projectId, ChatReq req) {
        User user = currentUser();
        assertPartyMember(projectId, user);

        String trimmedMessage = req.getMessage().trim();
        LlmChatReq llmReq = buildLlmChatReq(projectId, user.getId(), trimmedMessage);

        String reply = llmClient.requestProjectChat(llmReq);

        transactionTemplate.executeWithoutResult(status ->
                saveChatTurn(projectId, user.getId(), trimmedMessage, reply, MODE_ASK));

        log.info("▶ [ChatService] 프로젝트(ID: {}) Ask 응답 완료. userId={}", projectId, user.getId());
        return new ChatRes(reply);
    }

    /**
     * Agent 모드 — 다이어그램 수정 제안만 반환. 캔버스 DB는 반영하지 않음.
     * FastAPI features 트리를 translation(mapper)으로 blocks/edges로 바꿔 프론트에 반환.
     */
    public AgentRes agent(Integer projectId, ChatReq req) {
        User user = currentUser();
        assertNotGuest(projectId, user);

        String trimmedMessage = req.getMessage().trim();
        LlmChatReq llmReq = buildLlmChatReq(projectId, user.getId(), trimmedMessage);

        LlmModifyRes llmRes = llmClient.requestModifyDiagram(llmReq);
        CanvasDtos.SyncReq canvasProposal = translationService.toCanvas(llmRes.getDiagram());

        transactionTemplate.executeWithoutResult(status ->
                saveChatTurn(projectId, user.getId(), trimmedMessage, llmRes.getReply(), MODE_AGENT));

        log.info("▶ [ChatService] 프로젝트(ID: {}) Agent 제안 완료. userId={}", projectId, user.getId());
        return new AgentRes(
                llmRes.getReply(),
                canvasProposal.getBlocks(),
                canvasProposal.getEdges()
        );
    }

    /**
     * Agent 제안 확정 — agent 응답의 blocks/edges를 라이브 캔버스 DB에 반영.
     */
    public void agree(Integer projectId, CanvasDtos.SyncReq req) {
        User user = currentUser();
        assertNotGuest(projectId, user);

        if (req == null || req.getBlocks() == null) {
            throw new RuntimeException("적용할 blocks가 없습니다.");
        }

        canvasService.syncLiveCanvas(projectId, req);
        eventPublisher.publishEvent(new CrdtWebSocketHandler.DiagramUpdatedEvent(projectId, user.getId()));
        log.info("▶ [ChatService] 프로젝트(ID: {}) Agent 제안 적용 완료. userId={}, blocks={}, edges={}",
                projectId,
                user.getId(),
                req.getBlocks().size(),
                req.getEdges() != null ? req.getEdges().size() : 0);
    }

    private LlmChatReq buildLlmChatReq(Integer projectId, Integer userId, String message) {
        String descriptionPrompt = projectRepository.findDescriptionPromptById(projectId).orElse(null);
        DiagramRes diagram = translationService.exportFromDb(projectId, null);
        List<HistoryTurn> history = toHistoryTurns(
                chatMessageRepository.findTop20ByProjectIdAndUserIdOrderByCreatedAtDesc(projectId, userId));

        LlmChatReq llmReq = new LlmChatReq();
        llmReq.setMessage(message);
        llmReq.setDiagram(diagram);
        llmReq.setHistory(history);
        llmReq.setProjectContext(descriptionPrompt);
        return llmReq;
    }

    private void saveChatTurn(Integer projectId, Integer userId, String userMessage, String assistantReply, String mode) {
        Project projectRef = projectRepository.getReferenceById(projectId);
        User userRef = userRepository.getReferenceById(userId);
        saveMessage(projectRef, userRef, SENDER_USER, userMessage, mode);
        saveMessage(projectRef, userRef, SENDER_ASSISTANT, assistantReply, mode);
    }

    private List<ProjectChatMessage> findMessages(Integer projectId, Integer userId) {
        return chatMessageRepository.findByProjectIdAndUserIdOrderByCreatedAtAsc(projectId, userId);
    }

    /** DB DESC 조회 결과를 LLM용 시간순(ASC)으로 뒤집음 */
    private List<HistoryTurn> toHistoryTurns(List<ProjectChatMessage> newestFirst) {
        return newestFirst.reversed().stream()
                .map(m -> new HistoryTurn(m.getSender(), m.getMessage()))
                .toList();
    }

    private MessageRes toMessageRes(ProjectChatMessage message) {
        return new MessageRes(
                message.getId(),
                message.getSender(),
                message.getMode(),
                message.getMessage(),
                message.getCreatedAt()
        );
    }

    private void saveMessage(Project project, User user, String sender, String message, String mode) {
        chatMessageRepository.save(ProjectChatMessage.builder()
                .project(project)
                .user(user)
                .sender(sender)
                .message(message)
                .mode(mode)
                .build());
    }

    private User currentUser() {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("로그인 사용자를 찾을 수 없습니다."));
    }

    private void assertPartyMember(Integer projectId, User user) {
        partyRepository.findByProjectIdAndUserId(projectId, user.getId())
                .orElseThrow(() -> new RuntimeException("이 프로젝트에 접근할 권한이 없습니다."));
    }

    private void assertNotGuest(Integer projectId, User user) {
        Party party = partyRepository.findByProjectIdAndUserId(projectId, user.getId())
                .orElseThrow(() -> new RuntimeException("이 프로젝트에 접근할 권한이 없습니다."));
        if ("GUEST".equals(party.getRole())) {
            throw new RuntimeException("GUEST는 Agent 모드를 사용할 수 없습니다.");
        }
    }
}
