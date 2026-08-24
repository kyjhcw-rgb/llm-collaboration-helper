package com.capstone.collaborationhelper.repository;

import com.capstone.collaborationhelper.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Integer> {
    Optional<EmailVerification> findTopByEmailOrderByCreatedAtDesc(String email);
}