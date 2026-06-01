package com.capstone.collaborationhelper.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Edge {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
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