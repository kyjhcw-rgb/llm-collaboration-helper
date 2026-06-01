package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Integer> {
    // EmailService에서 사용
    Optional<EmailVerification> findByEmail(String email);

    // AuthService에서 최근 내역 조회용으로 사용
    Optional<EmailVerification> findTopByEmailOrderByCreatedAtDesc(String email);
}