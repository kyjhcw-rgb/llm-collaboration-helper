package com.capstone.collaborationhelper.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EmailVerification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false, length = 10)
    private String verificationCode;

    @Builder.Default
    private Boolean isVerified = false;

    private ZonedDateTime createdAt;

    @Column(nullable = false)
    private ZonedDateTime expiresAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = ZonedDateTime.now();
        if(this.expiresAt == null) this.expiresAt = ZonedDateTime.now().plusMinutes(5); // 5분 뒤 만료
    }
}