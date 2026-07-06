package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.client.LlmClient;
import com.capstone.collaborationhelper.dto.ChatDtos.ChatReq;
import com.capstone.collaborationhelper.dto.ChatDtos.ChatRes;
import com.capstone.collaborationhelper.dto.ChatDtos.HistoryTurn;
import com.capstone.collaborationhelper.dto.ChatDtos.LlmChatReq;
import com.capstone.collaborationhelper.dto.ChatDtos.MessageRes;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.ProjectChatMessage;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.PartyRepository;
import com.capstone.collaborationhelper.repository.ProjectChatMessageRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    private final TranslationService translationService;
    private final LlmClient llmClient;
    private final ProjectChatMessageRepository chatMessageRepository;
    private final ProjectRepository projectRepository;
    private final PartyRepository partyRepository;
    private final UserRepository userRepository;
    private final TransactionTemplate transactionTemplate;

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
        String descriptionPrompt = projectRepository.findDescriptionPromptById(projectId).orElse(null);
        DiagramRes diagram = translationService.exportFromDb(projectId, null);
        List<HistoryTurn> history = toHistoryTurns(
                chatMessageRepository.findTop20ByProjectIdAndUserIdOrderByCreatedAtDesc(projectId, user.getId()));

        LlmChatReq llmReq = new LlmChatReq();
        llmReq.setMessage(trimmedMessage);
        llmReq.setDiagram(diagram);
        llmReq.setHistory(history);
        llmReq.setProjectContext(descriptionPrompt);

        String reply = llmClient.requestProjectChat(llmReq);

        transactionTemplate.executeWithoutResult(status ->
                saveChatTurn(projectId, user.getId(), trimmedMessage, reply));

        log.info("▶ [ChatService] 프로젝트(ID: {}) 챗봇 응답 완료. userId={}", projectId, user.getId());
        return new ChatRes(reply);
    }

    private void saveChatTurn(Integer projectId, Integer userId, String userMessage, String assistantReply) {
        Project projectRef = projectRepository.getReferenceById(projectId);
        User userRef = userRepository.getReferenceById(userId);
        saveMessage(projectRef, userRef, SENDER_USER, userMessage);
        saveMessage(projectRef, userRef, SENDER_ASSISTANT, assistantReply);
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
                message.getMessage(),
                message.getCreatedAt()
        );
    }

    private void saveMessage(Project project, User user, String sender, String message) {
        chatMessageRepository.save(ProjectChatMessage.builder()
                .project(project)
                .user(user)
                .sender(sender)
                .message(message)
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
}
