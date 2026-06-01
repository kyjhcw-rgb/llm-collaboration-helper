package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.ProjectVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProjectVersionRepository extends JpaRepository<ProjectVersion, Integer> {
    List<ProjectVersion> findByProjectIdOrderByVersionNumberDesc(Integer projectId);
    Optional<ProjectVersion> findByProjectIdAndVersionNumber(Integer projectId, Integer versionNumber);
}