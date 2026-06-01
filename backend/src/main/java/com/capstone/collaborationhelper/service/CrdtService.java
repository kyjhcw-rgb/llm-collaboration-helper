package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.ProjectCrdtLog;
import com.capstone.collaborationhelper.repository.ProjectCrdtLogRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CrdtService {

    private final ProjectCrdtLogRepository crdtLogRepository;
    private final ProjectRepository projectRepository;

    @Transactional
    public void saveCrdtLog(Integer projectId, byte[] updateData) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("해당 프로젝트가 존재하지 않습니다."));

        // 유저 정보는 WebSocket 연결 시 추출한 정보를 넘겨받아 세팅할 수 있음 
        // 일단은 Yjs 바이너리 업데이트 위주로 저장
        ProjectCrdtLog crdtLog = ProjectCrdtLog.builder()
                .project(project)
                .updateData(updateData)
                .build();

        crdtLogRepository.save(crdtLog);
    }
}