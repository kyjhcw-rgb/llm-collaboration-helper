package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.entity.*;
import com.capstone.collaborationhelper.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CanvasService {
    private final ProjectRepository projectRepository;
    private final BlockRepository blockRepository;
    private final EdgeRepository edgeRepository;
    private final ProjectVersionRepository versionRepository;
    private final ObjectMapper objectMapper; // JSON <-> Byte 변환용 (Yjs 도입 전 임시)

    // [Read] 라이브(현재 작업 중인) 상태 불러오기 (isDeleted = false 인 것만)
    @Transactional(readOnly = true)
    public CanvasDtos.SyncRes loadLiveCanvas(Integer projectId) {
        List<Block> blocks = blockRepository.findByProjectIdAndIsDeletedFalse(projectId);
        List<Edge> edges = edgeRepository.findByProjectIdAndIsDeletedFalse(projectId);
        return new CanvasDtos.SyncRes(mapBlocksToDto(blocks), mapEdgesToDto(edges));
    }

    // [Read] 과거의 특정 박제 버전 불러오기 (Read-Only)
    @Transactional(readOnly = true)
    public CanvasDtos.SyncRes loadVersionCanvas(Integer projectId, Integer versionNumber) {
        ProjectVersion version = versionRepository.findByProjectIdAndVersionNumber(projectId, versionNumber)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 버전입니다."));

        try {
            // Yjs 도입 전이므로 저장해둔 JSON Byte 배열을 DTO로 변환하여 반환
            return objectMapper.readValue(version.getCrdtSnapshot(), CanvasDtos.SyncRes.class);
        } catch (Exception e) {
            throw new RuntimeException("버전 데이터를 읽는 중 오류가 발생했습니다.", e);
        }
    }

    // [Update] 라이브 스냅샷 동기화 (UNIQUE 제약조건을 지키기 위한 UPSERT 및 논리적 삭제)
    @Transactional
    public void syncLiveCanvas(Integer projectId, CanvasDtos.SyncReq req) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 프로젝트입니다."));

        // 라이브 동기화 시, 메인 화면 정렬을 위해 프로젝트 업데이트 시간 갱신
        project.setUpdatedAt(ZonedDateTime.now());
        projectRepository.save(project);

        // 1. Block UPSERT 및 논리적 삭제
        List<Block> existingBlocks = blockRepository.findByProjectId(projectId);
        Map<String, Block> blockMap = existingBlocks.stream()
                .collect(Collectors.toMap(Block::getFrontendId, b -> b));

        if (req.getBlocks() != null) {
            for (CanvasDtos.BlockDto dto : req.getBlocks()) {
                Block block = blockMap.get(dto.getFrontendId());
                if (block == null) {
                    // 신규 생성
                    block = Block.builder().project(project).frontendId(dto.getFrontendId()).build();
                }
                // 값 갱신 및 복구(삭제되었던 것이 다시 넘어올 경우 대비)
                block.setDeleted(false);
                block.setParentFrontendId(dto.getParentFrontendId());
                block.setType(dto.getType());
                block.setName(dto.getName());
                block.setDescription(dto.getDescription());
                block.setParameters(dto.getParameters());
                block.setReturnType(dto.getReturnType());
                block.setAnnotations(dto.getAnnotations());
                block.setPosX(dto.getPosX());
                block.setPosY(dto.getPosY());

                blockRepository.save(block);
                blockMap.remove(dto.getFrontendId()); // 처리된 것은 맵에서 제거
            }
        }
        // Map에 남아있는 블록들은 프론트엔드에서 지워진 것 -> 논리적 삭제 처리
        blockMap.values().stream().filter(b -> !b.isDeleted()).forEach(b -> {
            b.setDeleted(true);
            blockRepository.save(b);
        });

        // 2. Edge UPSERT 및 논리적 삭제 처리 (Block과 동일 로직)
        List<Edge> existingEdges = edgeRepository.findByProjectId(projectId);
        Map<String, Edge> edgeMap = existingEdges.stream()
                .collect(Collectors.toMap(Edge::getFrontendId, e -> e));

        if (req.getEdges() != null) {
            for (CanvasDtos.EdgeDto dto : req.getEdges()) {
                Edge edge = edgeMap.get(dto.getFrontendId());
                if (edge == null) {
                    edge = Edge.builder().project(project).frontendId(dto.getFrontendId()).build();
                }
                edge.setDeleted(false);
                edge.setSourceFrontendId(dto.getSourceFrontendId());
                edge.setTargetFrontendId(dto.getTargetFrontendId());
                edge.setSourceHandle(dto.getSourceHandle());
                edge.setTargetHandle(dto.getTargetHandle());
                edge.setType(dto.getType());
                edge.setBadgeCount(dto.getBadgeCount());

                edgeRepository.save(edge);
                edgeMap.remove(dto.getFrontendId());
            }
        }
        edgeMap.values().stream().filter(e -> !e.isDeleted()).forEach(e -> {
            e.setDeleted(true);
            edgeRepository.save(e);
        });
    }

    // [Create] 통일된 버전 박제 (Commit)
    @Transactional
    public Integer commitVersion(Integer projectId, String commitMessage) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 프로젝트입니다."));

        // 현재 활성 상태의 데이터를 읽어와서 스냅샷으로 만듦
        CanvasDtos.SyncRes currentState = loadLiveCanvas(projectId);
        byte[] snapshotBytes;
        try {
            snapshotBytes = objectMapper.writeValueAsBytes(currentState);
        } catch (Exception e) {
            throw new RuntimeException("스냅샷 생성 실패", e);
        }

        List<ProjectVersion> versions = versionRepository.findByProjectIdOrderByVersionNumberDesc(projectId);
        int nextVersion = versions.isEmpty() ? 1 : versions.get(0).getVersionNumber() + 1;

        ProjectVersion newVersion = ProjectVersion.builder()
                .project(project)
                .versionNumber(nextVersion)
                .commitMessage(commitMessage)
                .crdtSnapshot(snapshotBytes)
                .build();

        versionRepository.save(newVersion);
        return nextVersion;
    }

    // 버전 히스토리 리스트 반환
    @Transactional(readOnly = true)
    public List<CanvasDtos.VersionDto> getVersionHistory(Integer projectId) {
        return versionRepository.findByProjectIdOrderByVersionNumberDesc(projectId).stream()
                .map(v -> new CanvasDtos.VersionDto(v.getVersionNumber(), v.getCommitMessage(), v.getCreatedAt().toString()))
                .collect(Collectors.toList());
    }

    // 특정 과거 버전 삭제
    @Transactional
    public void deleteSpecificVersion(Integer projectId, Integer versionNumber) {
        versionRepository.findByProjectIdAndVersionNumber(projectId, versionNumber)
                .ifPresent(versionRepository::delete);
    }

    // Entity -> DTO 매핑 헬퍼 메서드
    private List<CanvasDtos.BlockDto> mapBlocksToDto(List<Block> blocks) {
        return blocks.stream().map(b -> {
            CanvasDtos.BlockDto dto = new CanvasDtos.BlockDto();
            dto.setFrontendId(b.getFrontendId());
            dto.setParentFrontendId(b.getParentFrontendId());
            dto.setType(b.getType());
            dto.setName(b.getName());
            dto.setDescription(b.getDescription());
            dto.setParameters(b.getParameters());
            dto.setReturnType(b.getReturnType());
            dto.setAnnotations(b.getAnnotations());
            dto.setPosX(b.getPosX());
            dto.setPosY(b.getPosY());
            return dto;
        }).collect(Collectors.toList());
    }

    private List<CanvasDtos.EdgeDto> mapEdgesToDto(List<Edge> edges) {
        return edges.stream().map(e -> {
            CanvasDtos.EdgeDto dto = new CanvasDtos.EdgeDto();
            dto.setFrontendId(e.getFrontendId());
            dto.setSourceFrontendId(e.getSourceFrontendId());
            dto.setTargetFrontendId(e.getTargetFrontendId());
            dto.setSourceHandle(e.getSourceHandle());
            dto.setTargetHandle(e.getTargetHandle());
            dto.setType(e.getType());
            dto.setBadgeCount(e.getBadgeCount());
            return dto;
        }).collect(Collectors.toList());
    }
}