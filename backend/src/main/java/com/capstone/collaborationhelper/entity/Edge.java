package com.capstone.collaborationhelper.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Edge {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @OnDelete(action = OnDeleteAction.CASCADE) // DB 스키마 꼬임 방지
    private Project project;

    @Column(name = "frontend_id", nullable = false)
    private String frontendId;

    @Column(name = "source_frontend_id", nullable = false)
    private String sourceFrontendId;

    @Column(name = "target_frontend_id", nullable = false)
    private String targetFrontendId;

    @Column(name = "source_handle")
    private String sourceHandle;

    @Column(name = "target_handle")
    private String targetHandle;

    private String type;

    @Column(name = "badge_count")
    private Integer badgeCount;

    @Builder.Default
    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_updated_by")
    private User lastUpdatedBy;
}