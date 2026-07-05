package com.capstone.collaborationhelper.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.time.LocalDateTime;

@Entity
@Table(name = "Project_CRDT_Log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectCrdtLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE) // DB 스키마 꼬임 방지
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "update_data", nullable = false, columnDefinition = "BYTEA")
    private byte[] updateData;

    // 수정: insertable = false 를 삭제하여 메모리에서 캡처한 정확한 시간을 넣을 수 있게 함(JPA가 null로 덮어쓰는 것 방지)
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}