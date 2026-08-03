package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.BlockComment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BlockCommentRepository extends JpaRepository<BlockComment, Integer> {
    List<BlockComment> findByProjectIdAndBlockFrontendIdOrderByCreatedAtAsc(Integer projectId, String blockFrontendId);
}