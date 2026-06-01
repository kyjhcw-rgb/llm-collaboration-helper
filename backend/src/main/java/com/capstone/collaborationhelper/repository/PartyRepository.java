package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PartyRepository extends JpaRepository<Party, Integer> {

    // 1. 유저 기준 참여 목록 조회 (ProjectService.getlist에서 사용)
    @EntityGraph(attributePaths = {"user"})
    List<Party> findByUser(User user);

    // 2. 프로젝트 기준 참여 멤버 조회 (PartyService.getMembersByProject에서 사용)
    List<Party> findByProject(Project project);

    // 3. 프로젝트 엔티티와 유저 엔티티로 관계 조회 (권한 체크용)
    Optional<Party> findByProjectAndUser(Project project, User user);

    // 4. [추가] 프로젝트 ID와 유저 ID 숫자로 직접 조회 (PartyService.updateMemberRole, removeMember에서 사용)
    Optional<Party> findByProjectIdAndUserId(Integer projectId, Integer userId);

    // 5. 프로젝트 삭제 시 관련 멤버 관계 일괄 삭제 (ProjectService.delete에서 사용)
    void deleteByProject(Project project);
}
