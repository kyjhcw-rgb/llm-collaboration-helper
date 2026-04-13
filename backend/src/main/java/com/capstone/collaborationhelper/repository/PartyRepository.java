package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PartyRepository extends JpaRepository<Party, Integer> {
    List<Party> findByUser(User user);

    List<Party> findByProject(Project project);

    Optional<Party> findByProjectAndUser(Project project, User user);

    void deleteByProject(Project project);
}
