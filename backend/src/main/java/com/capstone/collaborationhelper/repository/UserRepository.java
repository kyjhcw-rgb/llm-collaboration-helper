package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {

    // 회원가입, 로그인, 정보 수정 시 유저를 찾기 위한 핵심 메서드
    Optional<User> findByUsername(String username);

    // 이메일로 유저를 찾기 위한 메서드 (PartyService 멤버 초대 등에서 사용)
    Optional<User> findByEmail(String email);

    // 회원가입 시 중복 검사용 메서드
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    Optional<User> findByEmail(String email);
}