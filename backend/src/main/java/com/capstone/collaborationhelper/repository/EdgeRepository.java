package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Edge;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EdgeRepository extends JpaRepository<Edge, Integer> {
    List<Edge> findByProjectId(Integer projectId);
    List<Edge> findByProjectIdAndIsDeletedFalse(Integer projectId);
}