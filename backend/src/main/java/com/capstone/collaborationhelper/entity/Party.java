package com.capstone.collaborationhelper.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "party", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"project_id", "user_id"}) // 중복 참여 방지
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Party {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY) 
    @JoinColumn(name = "project_id", nullable = false) // null 방지 추가
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY) 
    @JoinColumn(name = "user_id", nullable = false) // null 방지 추가
    private User user;

    @Column(nullable = false, length = 50) // 길이 제한 및 null 방지
    private String role;

    @CreationTimestamp // 참여 시간 자동 기록
    @Column(name = "joined_at", updatable = false)
    private OffsetDateTime joinedAt;
}