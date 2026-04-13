package com.capstone.collaborationhelper.repository;
import com.capstone.collaborationhelper.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Integer> {
    // 가장 최근에 요청한 인증 기록을 가져옴
    Optional<EmailVerification> findTopByEmailOrderByCreatedAtDesc(String email);
}