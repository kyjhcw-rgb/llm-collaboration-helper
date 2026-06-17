package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Block;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BlockRepository extends JpaRepository<Block, Integer> {
    // 1. 특정 프로젝트의 모든 블록 조회 (동기화 비교용)
    List<Block> findByProjectId(Integer projectId);

    // 2. 특정 프로젝트의 살아있는(isDeleted=false) 블록만 조회 (프론트 초기 로딩 및 RAG 조회용)
    List<Block> findByProjectIdAndIsDeletedFalse(Integer projectId);
}