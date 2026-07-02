package com.capstone.collaborationhelper.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Block {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    @OnDelete(action = OnDeleteAction.CASCADE) // DB 스키마 꼬임 방지
    private Project project;

    @Column(name = "frontend_id", nullable = false)
    private String frontendId;

    @Column(name = "parent_frontend_id")
    private String parentFrontendId;

    private String type;
    private String name;
    private String description;
    private String parameters;

    @Column(name = "return_type")
    private String returnType;
    private String annotations;

    @Column(name = "pos_x")
    private Double posX;

    @Column(name = "pos_y")
    private Double posY;

    @Column(name = "width")
    private Double width;

    @Column(name = "height")
    private Double height;

    @Builder.Default
    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_updated_by")
    private User lastUpdatedBy;


}