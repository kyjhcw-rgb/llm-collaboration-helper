package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.client.LlmClient;
import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.PartyRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingService {

    private final LlmAsyncService llmAsyncService;
    private final LlmClient llmClient;
    private final PartyRepository partyRepository;
    private final UserRepository userRepository;

    /** 회의 음성 비동기 요청 트리거. 202 응답 후 Tomcat이 임시 파일을 지우므로 bytes는 여기서 미리 읽는다. */
    public void processAudioAsync(Integer projectId, MultipartFile file) {
        User user = currentUser();
        assertNotGuest(projectId, user);

        if (file == null || file.isEmpty()) {
            throw new RuntimeException("음성 파일이 비어 있습니다.");
        }

        byte[] audio;
        try {
            audio = file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("음성 파일을 읽을 수 없습니다.", e);
        }
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "meeting_audio.webm";

        llmAsyncService.processMeetingAsync(projectId, user.getId(), audio, filename);
    }

    /** 초기 설계 회의 음성 → 프로젝트 설명 (동기). 프로젝트 생성 전이라 Party 체크 없음 */
    public String describeProject(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("음성 파일이 비어 있습니다.");
        }

        byte[] audio;
        try {
            audio = file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("음성 파일을 읽을 수 없습니다.", e);
        }
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "meeting_audio.webm";
        String contentType = file.getContentType() != null ? file.getContentType() : "audio/webm";

        return llmClient.requestMeetingDescription(audio, filename, contentType);
    }

    private User currentUser() {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("로그인 사용자를 찾을 수 없습니다."));
    }

    private void assertNotGuest(Integer projectId, User user) {
        Party party = partyRepository.findByProjectIdAndUserId(projectId, user.getId())
                .orElseThrow(() -> new RuntimeException("이 프로젝트에 접근할 권한이 없습니다."));
        if ("GUEST".equals(party.getRole())) {
            throw new RuntimeException("GUEST는 회의 음성 분석을 사용할 수 없습니다.");
        }
    }
}
