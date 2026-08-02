package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.CommentDtos.*;
import com.capstone.collaborationhelper.entity.BlockComment;
import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.BlockCommentRepository;
import com.capstone.collaborationhelper.repository.PartyRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler.MentionEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BlockCommentService {

    private final BlockCommentRepository commentRepository;
    private final ProjectRepository projectRepository;
    private final PartyRepository partyRepository;
    private final UserRepository userRepository;

    // 알림용 서비스 주입
    private final ApplicationEventPublisher eventPublisher;
    private final EmailService emailService;

    @Transactional(readOnly = true)
    public List<Res> getComments(Integer projectId, String blockFrontendId) {
        assertPartyMember(projectId);
        return commentRepository.findByProjectIdAndBlockFrontendIdOrderByCreatedAtAsc(projectId, blockFrontendId)
                .stream().map(this::toRes).collect(Collectors.toList());
    }

    @Transactional
    public Res createComment(Integer projectId, String blockFrontendId, Req req) {
        User user = currentUser();
        assertPartyMember(projectId, user);
        Project project = projectRepository.findById(projectId).orElseThrow();

        // 멘션 추출 및 검증 (중복 멘션 방지를 위해 Set 사용)
        Set<User> mentionedUsers = extractAndValidateMentions(projectId, req.getContent());

        BlockComment comment = commentRepository.save(BlockComment.builder()
                .project(project)
                .blockFrontendId(blockFrontendId)
                .user(user)
                .content(req.getContent())
                .build());

        // 알림 발송 로직 (자신 멘션은 제외)
        for (User targetUser : mentionedUsers) {
            if (!targetUser.getId().equals(user.getId())) {
                // 1. 실시간 웹소켓 알림 이벤트 발행
                eventPublisher.publishEvent(new MentionEvent(projectId, targetUser.getId(), user.getNickname()));

                // 2. 이메일 알림 발송 (비동기로 처리하는 것이 좋으나 우선 try-catch로 흐름 방해 방지)
                try {
                    emailService.sendMentionEmail(targetUser.getEmail(), project.getTitle(), projectId, user.getNickname());
                } catch (Exception e) {
                    log.error("멘션 메일 발송 실패: {}", targetUser.getEmail(), e);
                }
            }
        }

        return toRes(comment);
    }

    @Transactional
    public Res updateComment(Integer projectId, Integer commentId, Req req) {
        User user = currentUser();
        assertPartyMember(projectId, user);

        // 수정 시에는 검증만 수행하고 알림은 중복해서 보내지 않음 (수정 스팸 방지)
        extractAndValidateMentions(projectId, req.getContent());

        BlockComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("댓글을 찾을 수 없습니다."));

        if (!comment.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("작성자만 수정할 수 있습니다.");
        }

        comment.setContent(req.getContent());
        return toRes(comment);
    }

    @Transactional
    public void deleteComment(Integer projectId, Integer commentId) {
        User user = currentUser();
        assertPartyMember(projectId, user);

        BlockComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("댓글을 찾을 수 없습니다."));

        if (!comment.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("작성자만 삭제할 수 있습니다.");
        }

        commentRepository.delete(comment);
    }

    private Set<User> extractAndValidateMentions(Integer projectId, String content) {
        Set<User> mentionedUsers = new HashSet<>();
        if (content == null) return mentionedUsers;

        Pattern pattern = Pattern.compile("@(\\S+)");
        Matcher matcher = pattern.matcher(content);

        List<Party> members = partyRepository.findByProject(projectRepository.getReferenceById(projectId));

        while (matcher.find()) {
            String mention = matcher.group(1);
            Party matchedParty = members.stream()
                    .filter(p -> p.getUser().getNickname().equals(mention))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("프로젝트에 참여 중인 멤버만 멘션할 수 있습니다: " + mention));

            mentionedUsers.add(matchedParty.getUser());
        }

        return mentionedUsers;
    }

    private Res toRes(BlockComment c) {
        return Res.builder()
                .id(c.getId())
                .blockFrontendId(c.getBlockFrontendId())
                .userId(c.getUser().getId())
                .nickname(c.getUser().getNickname())
                .content(c.getContent())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    private User currentUser() {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByUsername(username).orElseThrow();
    }

    private void assertPartyMember(Integer projectId) {
        assertPartyMember(projectId, currentUser());
    }

    private void assertPartyMember(Integer projectId, User user) {
        partyRepository.findByProjectIdAndUserId(projectId, user.getId())
                .orElseThrow(() -> new RuntimeException("프로젝트 멤버가 아닙니다."));
    }
}