package com.capstone.collaborationhelper.service;
import com.capstone.collaborationhelper.entity.EmailVerification;
import com.capstone.collaborationhelper.repository.EmailVerificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.ZonedDateTime;
import java.util.Random;

@Service @RequiredArgsConstructor
public class EmailService {
    private final JavaMailSender mailSender;
    private final EmailVerificationRepository verificationRepo;

    @Transactional
    public void sendVerificationEmail(String email) {
        // 6자리 난수 생성
        String code = String.format("%06d", new Random().nextInt(999999));

        // DB 저장 (5분 타이머는 Entity의 PrePersist에서 자동 세팅됨)
        verificationRepo.save(EmailVerification.builder()
                .email(email).verificationCode(code).build());

        // 메일 발송
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("[Our Diagram] 회원가입 이메일 인증번호");
        message.setText("인증번호는 [" + code + "] 입니다. 5분 안에 입력해주세요.");
        mailSender.send(message);
    }

    @Transactional
    public void verifyCode(String email, String code) {
        EmailVerification verification = verificationRepo.findTopByEmailOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new RuntimeException("인증 요청 기록이 없습니다."));

        if (verification.getExpiresAt().isBefore(ZonedDateTime.now())) {
            throw new RuntimeException("인증 시간이 만료되었습니다.");
        }
        if (!verification.getVerificationCode().equals(code)) {
            throw new RuntimeException("인증번호가 일치하지 않습니다.");
        }

        // 인증 성공 처리
        verification.setIsVerified(true);
        verificationRepo.save(verification);
    }
}