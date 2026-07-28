package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.ProjectCrdtLog;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.ProjectCrdtLogRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
@Service
@RequiredArgsConstructor
public class CrdtService {

    private final ProjectCrdtLogRepository crdtLogRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    // 인메모리 버퍼링 큐 (JPA 엔티티 대신 DTO 레코드 형태로 임시 저장하여 영속성 문제 방지)
    private record CrdtLogTask(Integer projectId, Integer userId, byte[] updateData) {}
    private final ConcurrentLinkedQueue<CrdtLogTask> logQueue = new ConcurrentLinkedQueue<>();

    // 1-1. 마우스 드래그 발생 시 DB에 즉시 쏘지 않고 큐에 넣음
    public void bufferCrdtLog(Integer projectId, Integer userId, byte[] updateData) {
        logQueue.offer(new CrdtLogTask(projectId, userId, updateData));
    }

    // 1-2. 백그라운드 스케줄러 (3초마다 실행하여 통째로 DB에 밀어 넣음)
    @Scheduled(fixedRate = 3000)
    @Transactional
    public void flushCrdtLogs() {
        if (logQueue.isEmpty()) return;

        List<ProjectCrdtLog> batchToSave = new ArrayList<>();
        int count = 0;

        while (!logQueue.isEmpty() && count < 500) { // 한 번에 최대 500개씩 처리
            CrdtLogTask task = logQueue.poll();
            if (task == null) break;
            // Null ID가 메모리 버퍼에 섞여 들어왔을 경우 스케줄러 폭파 방지
            if (task.projectId() == null || task.userId() == null) continue;

            Project projectProxy = projectRepository.getReferenceById(task.projectId());
            User userProxy = userRepository.getReferenceById(task.userId());

            ProjectCrdtLog logEntry = ProjectCrdtLog.builder()
                    .project(projectProxy)
                    .user(userProxy)
                    .updateData(task.updateData())
                    .build();
            batchToSave.add(logEntry);
            count++;
        }

        if (!batchToSave.isEmpty()) {
            crdtLogRepository.saveAll(batchToSave);
            log.info("[CRDT Batch Insert] 인메모리 버퍼에서 {}개의 로그를 DB에 일괄 저장 완료", batchToSave.size());
        }
    }

    // 프론트엔드의 REQUEST_SYNC 요청에 응답할 완벽한 통합 상태 패키징 API 추가
    public Map<String, Object> getFullSyncState(Integer projectId) {
        Project project = projectRepository.findById(projectId).orElse(null);
        String snapshotBase64 = (project != null && project.getCrdtSnapshot() != null) ?
                Base64.getEncoder().encodeToString(project.getCrdtSnapshot()) : null;

        List<String> logsBase64 = new ArrayList<>();

        // 1. DB에 밀려있는 로그 추출
        crdtLogRepository.findByProjectIdOrderByCreatedAtAsc(projectId)
                .forEach(log -> logsBase64.add(Base64.getEncoder().encodeToString(log.getUpdateData())));

        // 2. 메모리에 있는 최신 로그 추출
        for (CrdtLogTask task : logQueue) {
            if (projectId.equals(task.projectId())) {
                logsBase64.add(Base64.getEncoder().encodeToString(task.updateData()));
            }
        }

        // 스냅샷과 로그들을 묶어서 리턴
        Map<String, Object> state = new HashMap<>();
        state.put("type", "SYNC_STATE");
        state.put("snapshot", snapshotBase64);
        state.put("logs", logsBase64);
        return state;
    }
}