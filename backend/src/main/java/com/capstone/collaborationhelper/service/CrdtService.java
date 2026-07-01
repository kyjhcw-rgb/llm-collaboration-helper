package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.ProjectCrdtLog;
import com.capstone.collaborationhelper.entity.User;
import com.capstone.collaborationhelper.repository.ProjectCrdtLogRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import com.capstone.collaborationhelper.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CrdtService {

    private final ProjectCrdtLogRepository crdtLogRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    @Transactional
    public void saveCrdtLog(Integer projectId, Integer userId, byte[] updateData) {

        // N+1 해결: findById가 아니라 getReferenceById(프록시)를 사용
        // 이렇게 하면 SELECT 쿼리를 날리지 않고 INSERT문에 외래키(FK) 숫자만 바로 집어넣어 압도적으로 빠름
        Project projectProxy = projectRepository.getReferenceById(projectId);
        User userProxy = userRepository.getReferenceById(userId);

        ProjectCrdtLog logEntry = ProjectCrdtLog.builder()
                .project(projectProxy)
                .user(userProxy)
                .updateData(updateData)
                .build();

        crdtLogRepository.save(logEntry);
    }
}