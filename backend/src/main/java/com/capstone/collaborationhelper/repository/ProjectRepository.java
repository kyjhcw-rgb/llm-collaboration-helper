package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Integer> {

    @Query("SELECT p.descriptionPrompt FROM Project p WHERE p.id = :id")
    Optional<String> findDescriptionPromptById(@Param("id") Integer id);
}