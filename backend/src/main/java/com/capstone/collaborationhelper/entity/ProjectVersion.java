package com.capstone.collaborationhelper.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Table(name = "Project_Version", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"project_id", "version_number"})
})
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ProjectVersion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "commit_message")
    private String commitMessage;

    @Column(name = "crdt_snapshot", nullable = false, columnDefinition = "bytea")
    private byte[] crdtSnapshot;

    @Column(name = "created_at")
    private ZonedDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = ZonedDateTime.now();
    }
}