package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Integer> {

    @Query("SELECT p.descriptionPrompt FROM Project p WHERE p.id = :id")
    Optional<String> findDescriptionPromptById(@Param("id") Integer id);

    // 회원 탈퇴 시 방장이 소유한 프로젝트를 조회하기 위한 메서드
    List<Project> findByOwner(User owner);
}