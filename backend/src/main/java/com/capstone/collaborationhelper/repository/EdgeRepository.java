// src/main/java/com/capstone/collaborationhelper/repository/EdgeRepository.java
package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Edge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EdgeRepository extends JpaRepository<Edge, Integer> {
    List<Edge> findByProjectIdAndVersion(Integer projectId, Integer version);

    // 특정 버전의 엣지 일괄 삭제용
    void deleteByProjectIdAndVersion(Integer projectId, Integer version);
}