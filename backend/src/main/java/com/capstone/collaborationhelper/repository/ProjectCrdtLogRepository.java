package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.ProjectCrdtLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProjectCrdtLogRepository extends JpaRepository<ProjectCrdtLog, Long> {
    // 프로젝트 입장 시 기존에 쌓인 로그를 불러오기 위한 쿼리
    List<ProjectCrdtLog> findAllByProjectIdOrderByCreatedAtAsc(Integer projectId); // 여기도 Integer
}