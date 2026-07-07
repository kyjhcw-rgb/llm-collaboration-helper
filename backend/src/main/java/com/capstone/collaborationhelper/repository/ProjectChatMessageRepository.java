package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.ProjectChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectChatMessageRepository extends JpaRepository<ProjectChatMessage, Integer> {

    List<ProjectChatMessage> findByProjectIdAndUserIdOrderByCreatedAtAsc(Integer projectId, Integer userId);

    /** POST LLM history용 — DB에서 최근 N턴만 조회 (내림차순) */
    List<ProjectChatMessage> findTop20ByProjectIdAndUserIdOrderByCreatedAtDesc(Integer projectId, Integer userId);
}
