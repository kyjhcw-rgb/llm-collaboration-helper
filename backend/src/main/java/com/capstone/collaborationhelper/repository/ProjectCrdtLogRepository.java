package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.ProjectCrdtLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ProjectCrdtLogRepository extends JpaRepository<ProjectCrdtLog, Integer> {

    // Race Condition 방지: 특정 시간(syncTime) 이전에 생성된 로그만 안전하게 벌크 삭제
    @Modifying
    @Query("delete from ProjectCrdtLog p where p.project.id = :projectId and p.createdAt <= :syncTime")
    void deleteByProjectIdAndCreatedAtBefore(@Param("projectId") Integer projectId, @Param("syncTime") LocalDateTime syncTime);

    // 특정 프로젝트의 미동기화 로그를 생성 시간 오름차순으로 조회 (Catch-up 용)
    List<ProjectCrdtLog> findByProjectIdOrderByCreatedAtAsc(Integer projectId);
}