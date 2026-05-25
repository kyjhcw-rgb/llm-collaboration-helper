package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Block;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface BlockRepository extends JpaRepository<Block, Integer> {
    // 라이브 상태 중 살아있는(isDeleted=false) 블록만 조회
    List<Block> findByProjectIdAndIsDeletedFalse(Integer projectId);

    // 특정 프로젝트의 모든 블록 (UPSERT 비교용)
    List<Block> findByProjectId(Integer projectId);
}