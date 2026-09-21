package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.client.LlmClient;
import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.dto.ChatDtos.AgentRes;
import com.capstone.collaborationhelper.dto.ChatDtos.ChatRes;
import com.capstone.collaborationhelper.dto.ChatDtos.HistoryTurn;
import com.capstone.collaborationhelper.dto.ChatDtos.LlmChatReq;
import com.capstone.collaborationhelper.dto.ChatDtos.LlmModifyRes;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.ProjectChatMessage;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.ProjectChatMessageRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler.AiCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class LlmAsyncService {

    private final LlmClient llmClient;
    private final TranslationService translationService;
    private final ProjectRepository projectRepository;
    private final ProjectChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    /** Ask 모드 비동기 처리 (AOP 프록시 정상 가동) */
    @Async
    public void processChatAsync(Integer projectId, Integer userId, String trimmedMessage) {
        try {
            // 1. [DB 커넥션 획득 및 반납] LLM에 전송할 데이터 조회를 짧은 트랜잭션으로 수행
            LlmChatReq llmReq = buildLlmChatReq(projectId, userId, trimmedMessage);

            // 2. [DB 커넥션 없음] 77초 소요되는 외부 AI 서버 호출 (HikariCP 고갈 방지)
            String reply = llmClient.requestProjectChat(llmReq);

            // 3. [DB 커넥션 획득 및 반납] AI 대화 내역 저장
            saveChatTurn(projectId, userId, trimmedMessage, reply, ChatService.MODE_ASK);

            log.info("▶ [LlmAsyncService] Ask 비동기 응답 완료. projectId={}, userId={}", projectId, userId);

            // 4. WebSocket 완료 이벤트 발행
            eventPublisher.publishEvent(new AiCompletedEvent(projectId, userId, ChatService.MODE_ASK, true, new ChatRes(reply)));
        } catch (Exception e) {
            log.error("Ask 비동기 처리 오류", e);
            eventPublisher.publishEvent(new AiCompletedEvent(projectId, userId, ChatService.MODE_ASK, false, e.getMessage()));
        }
    }

    /** Agent 모드 비동기 처리 (AOP 프록시 정상 가동) */
    @Async
    public void processAgentAsync(Integer projectId, Integer userId, String trimmedMessage) {
        try {
            // 1. DB 요청 데이터 준비
            LlmChatReq llmReq = buildLlmChatReq(projectId, userId, trimmedMessage);

            // 2. DB 커넥션 없이 외부 AI 서버 호출 (77초 대기)
            LlmModifyRes llmRes = llmClient.requestModifyDiagram(llmReq);

            // 3. DTO 변환 (순수 메모리 연산)
            CanvasDtos.SyncReq canvasProposal = translationService.toCanvas(llmRes.getDiagram());

            // 4. DB 대화 내역 저장
            saveChatTurn(projectId, userId, trimmedMessage, llmRes.getReply(), ChatService.MODE_AGENT);

            log.info("▶ [LlmAsyncService] Agent 제안 비동기 완료. projectId={}, userId={}", projectId, userId);

            AgentRes agentRes = new AgentRes(
                    llmRes.getReply(),
                    canvasProposal.getBlocks(),
                    canvasProposal.getEdges()
            );

            // 5. WebSocket 완료 이벤트 발행
            eventPublisher.publishEvent(new AiCompletedEvent(projectId, userId, ChatService.MODE_AGENT, true, agentRes));
        } catch (Exception e) {
            log.error("Agent 비동기 처리 오류", e);
            eventPublisher.publishEvent(new AiCompletedEvent(projectId, userId, ChatService.MODE_AGENT, false, e.getMessage()));
        }
    }

    @Transactional(readOnly = true)
    public LlmChatReq buildLlmChatReq(Integer projectId, Integer userId, String message) {
        String descriptionPrompt = projectRepository.findDescriptionPromptById(projectId).orElse(null);
        DiagramRes diagram = translationService.exportFromDb(projectId, null);
        List<HistoryTurn> history = chatMessageRepository.findTop20ByProjectIdAndUserIdOrderByCreatedAtDesc(projectId, userId)
                .reversed().stream()
                .map(m -> new HistoryTurn(m.getSender(), m.getMessage()))
                .toList();

        LlmChatReq llmReq = new LlmChatReq();
        llmReq.setMessage(message);
        llmReq.setDiagram(diagram);
        llmReq.setHistory(history);
        llmReq.setProjectContext(descriptionPrompt);
        return llmReq;
    }

    @Transactional
    public void saveChatTurn(Integer projectId, Integer userId, String userMessage, String assistantReply, String mode) {
        Project projectRef = projectRepository.getReferenceById(projectId);
        User userRef = userRepository.getReferenceById(userId);

        chatMessageRepository.save(ProjectChatMessage.builder()
                .project(projectRef)
                .user(userRef)
                .sender(ChatService.SENDER_USER)
                .message(userMessage)
                .mode(mode)
                .build());

        chatMessageRepository.save(ProjectChatMessage.builder()
                .project(projectRef)
                .user(userRef)
                .sender(ChatService.SENDER_ASSISTANT)
                .message(assistantReply)
                .mode(mode)
                .build());
    }
}