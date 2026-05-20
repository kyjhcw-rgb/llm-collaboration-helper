// src/main/java/com/capstone/collaborationhelper/repository/BlockRepository.java
package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Block;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BlockRepository extends JpaRepository<Block, Integer> {
    List<Block> findByProjectIdAndVersion(Integer projectId, Integer version);

    // 특정 프로젝트에 존재하는 다이어그램 버전 목록을 내림차순(최신순)으로 조회
    @Query("SELECT DISTINCT b.version FROM Block b WHERE b.project.id = :projectId ORDER BY b.version DESC")
    List<Integer> findAvailableVersions(@Param("projectId") Integer projectId);

    // 특정 버전의 블록 일괄 삭제용
    void deleteByProjectIdAndVersion(Integer projectId, Integer version);
}