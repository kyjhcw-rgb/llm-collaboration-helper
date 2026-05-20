package com.capstone.collaborationhelper.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Block {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @Column(name = "frontend_id")
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

    private Integer version;
}