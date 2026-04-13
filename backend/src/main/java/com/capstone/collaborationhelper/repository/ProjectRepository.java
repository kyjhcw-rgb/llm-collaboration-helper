package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Integer> {
}
