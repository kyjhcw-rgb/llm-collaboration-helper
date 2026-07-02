package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.ProjectCrdtLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.ZonedDateTime;

public interface ProjectCrdtLogRepository extends JpaRepository<ProjectCrdtLog, Integer> {

    // Race Condition 방지: 특정 시간(syncTime) 이전에 생성된 로그만 안전하게 벌크 삭제
    @Modifying
    @Query("delete from ProjectCrdtLog p where p.project.id = :projectId and p.createdAt <= :syncTime")
    void deleteByProjectIdAndCreatedAtBefore(@Param("projectId") Integer projectId, @Param("syncTime") ZonedDateTime syncTime);
}