package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.ProjectCrdtLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface ProjectCrdtLogRepository extends JpaRepository<ProjectCrdtLog, Integer> {

    @Modifying
    @Query("delete from ProjectCrdtLog p where p.project.id = :projectId and p.createdAt <= :syncTime")
    void deleteByProjectIdAndCreatedAtBefore(@Param("projectId") Integer projectId, @Param("syncTime") LocalDateTime syncTime);
}