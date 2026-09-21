package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.dto.ChatDtos.ChatReq;
import com.capstone.collaborationhelper.dto.ChatDtos.MessageRes;
import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.ProjectChatMessage;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.PartyRepository;
import com.capstone.collaborationhelper.repository.ProjectChatMessageRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    public static final String SENDER_USER = "USER";
    public static final String SENDER_ASSISTANT = "ASSISTANT";

    public static final String MODE_ASK = "ASK";
    public static final String MODE_AGENT = "AGENT";

    private final CanvasService canvasService;
    private final LlmAsyncService llmAsyncService;
    private final ProjectChatMessageRepository chatMessageRepository;
    private final PartyRepository partyRepository;
    private final UserRepository userRepository;

    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<MessageRes> getMessages(Integer projectId) {
        User user = currentUser();
        assertPartyMember(projectId, user);
        return findMessages(projectId, user.getId()).stream()
                .map(this::toMessageRes)
                .toList();
    }

    /** Ask 모드 비동기 요청 트리거 */
    public void chatAsync(Integer projectId, ChatReq req) {
        User user = currentUser();
        assertPartyMember(projectId, user);
        String trimmedMessage = req.getMessage().trim();

        // 외부 LlmAsyncService 호출로 프록시 기반 백그라운드 스레드 확실하게 분리
        llmAsyncService.processChatAsync(projectId, user.getId(), trimmedMessage);
    }

    /** Agent 모드 비동기 요청 트리거 */
    public void agentAsync(Integer projectId, ChatReq req) {
        User user = currentUser();
        assertNotGuest(projectId, user);
        String trimmedMessage = req.getMessage().trim();

        // 외부 LlmAsyncService 호출로 프록시 기반 백그라운드 스레드 확실하게 분리
        llmAsyncService.processAgentAsync(projectId, user.getId(), trimmedMessage);
    }

    /** Agent 제안 확정 */
    @Transactional
    public void agree(Integer projectId, CanvasDtos.SyncReq req) {
        User user = currentUser();
        assertNotGuest(projectId, user);

        if (req == null || req.getBlocks() == null) {
            throw new RuntimeException("적용할 blocks가 없습니다.");
        }

        canvasService.syncLiveCanvas(projectId, req);
        eventPublisher.publishEvent(new CrdtWebSocketHandler.DiagramUpdatedEvent(projectId, user.getId()));
        log.info("▶ [ChatService] 프로젝트(ID: {}) Agent 제안 적용 완료. userId={}", projectId, user.getId());
    }

    private List<ProjectChatMessage> findMessages(Integer projectId, Integer userId) {
        return chatMessageRepository.findByProjectIdAndUserIdOrderByCreatedAtAsc(projectId, userId);
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