package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.Party;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.entity.User;
import org.springframework.data.jpa.repository.EntityGraph; 
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;    
import org.springframework.data.jpa.repository.Query;        
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PartyRepository extends JpaRepository<Party, Integer> {

    // 1. 유저 기준 참여 목록 조회
    List<Party> findByUser(User user);

    // 2. 프로젝트 기준 참여 멤버 조회 (N+1 방지를 위해 user를 EntityGraph로 묶음)
    @EntityGraph(attributePaths = {"user"}) // 👈 1번에서 2번으로 이동
    List<Party> findByProject(Project project);

    // 3. 프로젝트 엔티티와 유저 엔티티로 관계 조회 (권한 체크용)
    Optional<Party> findByProjectAndUser(Project project, User user);

    // 4. 프로젝트 ID와 유저 ID 숫자로 직접 조회
    Optional<Party> findByProjectIdAndUserId(Integer projectId, Integer userId);

    // 5. 웹소켓 JWT 토큰(email 기반) 인증 및 권한 확인용 메서드
    Optional<Party> findByProject_IdAndUser_Email(Integer projectId, String email);

    // 6. 벌크 연산을 이용한 일괄 삭제 최적화 (쿼리 1번만 나감)
    @Modifying
    @Query("delete from Party p where p.project = :project")
    void deleteByProject(@Param("project") Project project);
}
