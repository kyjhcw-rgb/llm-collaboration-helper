package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.ProjectCrdtLog;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.ProjectCrdtLogRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
@Service
@RequiredArgsConstructor
public class CrdtService {

    private final ProjectCrdtLogRepository crdtLogRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    // 1. 메모리에 담아둘 순수 데이터 객체(DTO) 생성
    @Getter
    @AllArgsConstructor
    private static class CrdtLogDto {
        private Integer projectId;
        private Integer userId;
        private byte[] updateData;
        private LocalDateTime createdAt;
    }

    // 2. 엔티티 대신 DTO를 담도록 큐 타입 변경
    private final ConcurrentLinkedQueue<CrdtLogDto> logBuffer = new ConcurrentLinkedQueue<>();


    // 3. 메모리에 담는 행위이므로 @Transactional을 제거하여 성능 극대화 및 프록시 의존성 제거
    public void saveCrdtLog(Integer projectId, Integer userId, byte[] updateData) {
        logBuffer.add(new CrdtLogDto(projectId, userId, updateData, LocalDateTime.now()));
    }

    // 4. 스케줄러 트랜잭션 내부에서 안전하게 프록시 생성 및 Batch Insert
    @Scheduled(fixedDelay = 3000)
    @Transactional
    public void flushLogsToDb() {
        if (logBuffer.isEmpty()) return;

        List<ProjectCrdtLog> batch = new ArrayList<>();
        // OOM(메모리 초과) 방지를 위해 한 번에 최대 1000개까지만 꺼내서 저장
        while (!logBuffer.isEmpty() && batch.size() < 1000) {
            CrdtLogDto dto = logBuffer.poll();

            // 이 트랜잭션(Session) 내부에서 프록시를 생성하므로 충돌(LazyInitializationException)이 발생하지 않음!
            Project projectProxy = projectRepository.getReferenceById(dto.getProjectId());
            User userProxy = userRepository.getReferenceById(dto.getUserId());

            batch.add(ProjectCrdtLog.builder()
                    .project(projectProxy)
                    .user(userProxy)
                    .updateData(dto.getUpdateData())
                    .createdAt(dto.getCreatedAt())
                    .build());
        }

        if (!batch.isEmpty()) {
            crdtLogRepository.saveAll(batch);
            log.info("[In-Memory] 임시 CRDT 로그 {}개를 DB로 안전하게 Flush 했습니다.", batch.size());
        }
    }
}