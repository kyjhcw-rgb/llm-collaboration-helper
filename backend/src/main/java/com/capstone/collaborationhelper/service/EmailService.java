package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.entity.EmailVerification;
import com.capstone.collaborationhelper.repository.EmailVerificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final EmailVerificationRepository emailVerificationRepository;

    @Transactional
    public void sendVerificationEmail(String email) {
        // 1. 6자리 인증번호 랜덤 생성
        String code = String.format("%06d", new Random().nextInt(1000000));

        // 2. 기존 인증 정보가 있으면 덮어쓰고, 없으면 새로 생성
        EmailVerification verification = emailVerificationRepository.findByEmail(email)
                .orElse(EmailVerification.builder().email(email).build());

        verification.setVerificationCode(code);
        verification.setVerified(false);
        verification.setExpiresAt(LocalDateTime.now().plusMinutes(5)); // 5분 뒤 만료

        emailVerificationRepository.save(verification);

        // 3. 실제 이메일 발송
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("[Our Diagram] 회원가입 이메일 인증번호");
        message.setText("인증번호는 [" + code + "] 입니다.\n5분 안에 화면에 입력해주세요.");
        mailSender.send(message);
    }

    @Transactional
    public void verifyCode(String email, String code) {
        EmailVerification verification = emailVerificationRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("인증 요청된 이메일이 아닙니다."));

        // 만료 시간 체크
        if (verification.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("인증 시간이 초과되었습니다. 다시 요청해주세요.");
        }

        // 인증 번호 일치 체크
        if (!verification.getVerificationCode().equals(code)) {
            throw new RuntimeException("인증번호가 일치하지 않습니다.");
        }

        // 인증 완료 처리
        verification.setVerified(true);
        emailVerificationRepository.save(verification);
    }
}