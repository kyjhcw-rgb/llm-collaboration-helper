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

    private record CrdtLogTask(Integer projectId, Integer userId, byte[] updateData) {}
    private final ConcurrentLinkedQueue<CrdtLogTask> logQueue = new ConcurrentLinkedQueue<>();

    public void bufferCrdtLog(Integer projectId, Integer userId, byte[] updateData) {
        logQueue.offer(new CrdtLogTask(projectId, userId, updateData));
    }

    @Scheduled(fixedRate = 3000)
    @Transactional
    public void flushCrdtLogs() {
        if (logQueue.isEmpty()) return;

        List<ProjectCrdtLog> batchToSave = new ArrayList<>();
        int count = 0;

        while (!logQueue.isEmpty() && count < 500) {
            CrdtLogTask task = logQueue.poll();
            if (task == null) break;
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

    @Transactional(readOnly = true)
    public Map<String, Object> getFullSyncState(Integer projectId) {
        Project project = projectRepository.findById(projectId).orElse(null);
        String snapshotBase64 = (project != null && project.getCrdtSnapshot() != null) ?
                Base64.getEncoder().encodeToString(project.getCrdtSnapshot()) : null;

        List<String> logsBase64 = new ArrayList<>();

        // 1. 메모리 큐에 쌓여있는 해당 프로젝트 로그 스냅샷 세척 복사 (동시성 타이밍 이슈로 인한 로그 유실 방지)
        List<byte[]> memoryLogs = logQueue.stream()
                .filter(task -> projectId.equals(task.projectId()))
                .map(CrdtLogTask::updateData)
                .toList();

        // 2. DB에 이미 플러시된 로그 조회
        crdtLogRepository.findByProjectIdOrderByCreatedAtAsc(projectId)
                .forEach(log -> logsBase64.add(Base64.getEncoder().encodeToString(log.getUpdateData())));

        // 3. 메모리에 남아있는 최신 로그 추가
        memoryLogs.forEach(data -> logsBase64.add(Base64.getEncoder().encodeToString(data)));

        Map<String, Object> state = new HashMap<>();
        state.put("type", "SYNC_STATE");
        state.put("snapshot", snapshotBase64);
        state.put("logs", logsBase64);
        return state;
    }
}