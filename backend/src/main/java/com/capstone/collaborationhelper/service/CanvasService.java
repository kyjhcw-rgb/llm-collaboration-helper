package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.entity.*;
import com.capstone.collaborationhelper.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CanvasService {
    private final ProjectRepository projectRepository;
    private final BlockRepository blockRepository;
    private final EdgeRepository edgeRepository;
    private final ProjectVersionRepository versionRepository;
    private final ObjectMapper objectMapper;

    // [보안 및 정리를 위한 Repository 추가]
    private final UserRepository userRepository;
    private final PartyRepository partyRepository;
    private final ProjectCrdtLogRepository crdtLogRepository;

    // [Read] 라이브(현재 작업 중인) 상태 불러오기
    @Transactional(readOnly = true)
    public CanvasDtos.SyncRes loadLiveCanvas(Integer projectId) {
        assertPartyMember(projectId);
        List<Block> blocks = blockRepository.findByProjectIdAndIsDeletedFalse(projectId);
        List<Edge> edges = edgeRepository.findByProjectIdAndIsDeletedFalse(projectId);
        return new CanvasDtos.SyncRes(mapBlocksToDto(blocks), mapEdgesToDto(edges));
    }

    // [Read] 과거의 특정 박제 버전 불러오기
    @Transactional(readOnly = true)
    public CanvasDtos.SyncRes loadVersionCanvas(Integer projectId, Integer versionNumber) {
        assertPartyMember(projectId);
        ProjectVersion version = versionRepository.findByProjectIdAndVersionNumber(projectId, versionNumber)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 버전입니다."));

        try {
            return objectMapper.readValue(version.getCrdtSnapshot(), CanvasDtos.SyncRes.class);
        } catch (Exception e) {
            throw new RuntimeException("버전 데이터를 읽는 중 오류가 발생했습니다.", e);
        }
    }

    // [Update] 라이브 스냅샷 동기화
    @Transactional
    public void syncLiveCanvas(Integer projectId, CanvasDtos.SyncReq req) {
        // 1. 동기화를 시작하는 현재 시간을 기록합니다. (데이터 증발 방지용)
        ZonedDateTime syncStartTime = ZonedDateTime.now();

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 프로젝트입니다."));

        assertNotGuest(projectId);

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
                    block = Block.builder().project(project).frontendId(dto.getFrontendId()).build();
                }
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
                blockMap.remove(dto.getFrontendId());
            }
        }

        // 최적화: N+1 삭제 쿼리 방지를 위해 saveAll() 벌크 처리
        List<Block> blocksToDelete = blockMap.values().stream()
                .filter(b -> !b.isDeleted())
                .peek(b -> b.setDeleted(true))
                .collect(Collectors.toList());
        blockRepository.saveAll(blocksToDelete);

        // 2. Edge UPSERT 및 논리적 삭제 처리
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

        // 최적화: Edge 역시 saveAll() 벌크 처리로 수정
        List<Edge> edgesToDelete = edgeMap.values().stream()
                .filter(e -> !e.isDeleted())
                .peek(e -> e.setDeleted(true))
                .collect(Collectors.toList());
        edgeRepository.saveAll(edgesToDelete);

        // 2. 최종 정리: 무조건 다 지우지 말고, 아까 기록해둔 시간 '이전'의 로그만 지워서 찰나의 유실을 막습니다.
        crdtLogRepository.deleteByProjectIdAndCreatedAtBefore(projectId, syncStartTime);
    }

    // [Create] 통일된 버전 박제 (Commit)
    @Transactional
    public Integer commitVersion(Integer projectId, String commitMessage) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 프로젝트입니다."));

        assertNotGuest(projectId);

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
        log.info("▶ [CanvasService] 프로젝트(ID: {})의 새로운 버전(v{})이 저장되었습니다.", projectId, nextVersion);
        return nextVersion;
    }

    // 버전 히스토리 리스트 반환
    @Transactional(readOnly = true)
    public List<CanvasDtos.VersionDto> getVersionHistory(Integer projectId) {
        assertPartyMember(projectId);
        return versionRepository.findByProjectIdOrderByVersionNumberDesc(projectId).stream()
                .map(v -> new CanvasDtos.VersionDto(v.getVersionNumber(), v.getCommitMessage(), v.getCreatedAt().toString()))
                .collect(Collectors.toList());
    }

    // 특정 과거 버전 삭제
    @Transactional
    public void deleteSpecificVersion(Integer projectId, Integer versionNumber) {
        assertOwner(projectId);

        versionRepository.findByProjectIdAndVersionNumber(projectId, versionNumber)
                .ifPresent(versionRepository::delete);
        log.info("▶ [CanvasService] 프로젝트(ID: {})의 버전(v{})이 삭제되었습니다.", projectId, versionNumber);
    }

    // ===============================================
    // 권한 체크 및 헬퍼 메서드 모음
    // ===============================================

    private User currentUser() {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("로그인 사용자를 찾을 수 없습니다."));
    }

    private Party getMyPartyInfo(Integer projectId) {
        User me = currentUser();
        return partyRepository.findByProjectIdAndUserId(projectId, me.getId())
                .orElseThrow(() -> new RuntimeException("이 프로젝트에 접근할 권한이 없습니다."));
    }

    private void assertPartyMember(Integer projectId) {
        getMyPartyInfo(projectId);
    }

    private void assertNotGuest(Integer projectId) {
        Party myParty = getMyPartyInfo(projectId);
        if ("GUEST".equals(myParty.getRole())) {
            throw new RuntimeException("읽기 전용(GUEST) 권한은 다이어그램을 덮어쓰거나 버전을 저장할 수 없습니다.");
        }
    }

    private void assertOwner(Integer projectId) {
        Party myParty = getMyPartyInfo(projectId);
        if (!"OWNER".equals(myParty.getRole())) {
            throw new RuntimeException("프로젝트 소유자(OWNER)만 이 작업을 수행할 수 있습니다.");
        }
    }

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