package com.capstone.collaborationhelper.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Project {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(nullable = false)
    private String title;

    private String framework;
    private Integer freedomLevel;

    @Column(columnDefinition = "TEXT")
    private String descriptionPrompt;

    @Builder.Default
    private String diagramState = "root";

    @Column(name = "crdt_snapshot", columnDefinition = "bytea")
    private byte[] crdtSnapshot; // 라이브 스냅샷 상태

    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = ZonedDateTime.now();
        this.updatedAt = ZonedDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = ZonedDateTime.now();
    }
}