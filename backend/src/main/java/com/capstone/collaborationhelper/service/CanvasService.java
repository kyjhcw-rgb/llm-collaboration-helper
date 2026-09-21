package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.entity.*;
import com.capstone.collaborationhelper.repository.*;
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler.ForceReloadEvent;
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler.VersionCreatedEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final UserRepository userRepository;
    private final PartyRepository partyRepository;
    private final ProjectCrdtLogRepository crdtLogRepository;

    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public CanvasDtos.SyncRes loadLiveCanvas(Integer projectId) {
        assertPartyMember(projectId);
        Project project = projectRepository.findById(projectId).orElseThrow();
        List<Block> blocks = blockRepository.findByProjectIdAndIsDeletedFalse(projectId);
        List<Edge> edges = edgeRepository.findByProjectIdAndIsDeletedFalse(projectId);

        String yjsDataBase64 = project.getCrdtSnapshot() != null ?
                java.util.Base64.getEncoder().encodeToString(project.getCrdtSnapshot()) : null;

        return new CanvasDtos.SyncRes(mapBlocksToDto(blocks), mapEdgesToDto(edges), yjsDataBase64);
    }

    @Transactional(readOnly = true)
    public CanvasDtos.SyncRes loadVersionCanvas(Integer projectId, Integer versionNumber) {
        assertPartyMember(projectId);
        ProjectVersion version = versionRepository.findByProjectIdAndVersionNumber(projectId, versionNumber)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 버전입니다."));
        try {
            return objectMapper.readValue(version.getCrdtSnapshot(), CanvasDtos.SyncRes.class);
        } catch (Exception e) {
            throw new RuntimeException("스냅샷 파싱 실패", e);
        }
    }

    // [STEP 2] 프론트엔드의 최신 상태를 DB와 동기화
    @Transactional
    public void syncLiveCanvas(Integer projectId, CanvasDtos.SyncReq req) {
        LocalDateTime syncStartTime = LocalDateTime.now();
        Project project = projectRepository.findById(projectId).orElseThrow();
        assertNotGuest(projectId);

        project.setUpdatedAt(ZonedDateTime.now());

        // yjsData가 명시적으로 전달되고 비어있지 않을 때만 안전하게 바이너리 스냅샷 업데이트
        if (req.getYjsData() != null && !req.getYjsData().isBlank()) {
            project.setCrdtSnapshot(java.util.Base64.getDecoder().decode(req.getYjsData()));
        }
        // 빈 문자열("")이나 null이 들어오더라도 기존 crdtSnapshot을 함부로 null로 파괴하지 않음

        projectRepository.save(project);

        // 1. Block UPSERT
        List<Block> existingBlocks = blockRepository.findByProjectId(projectId);
        Map<String, Block> blockMap = existingBlocks.stream().collect(Collectors.toMap(Block::getFrontendId, b -> b));

        if (req.getBlocks() != null) {
            for (CanvasDtos.BlockDto dto : req.getBlocks()) {
                Block block = blockMap.get(dto.getFrontendId());
                if (block == null) {
                    block = Block.builder().project(project).frontendId(dto.getFrontendId()).build();
                }
                applyBlockDto(block, dto);
                blockRepository.save(block);
                blockMap.remove(dto.getFrontendId());
            }
        }
        List<Block> blocksToDelete = blockMap.values().stream().filter(b -> !b.isDeleted()).peek(b -> b.setDeleted(true)).toList();
        blockRepository.saveAll(blocksToDelete);

        // 2. Edge 검증 및 UPSERT (유효한 노드 간 연결만 DB에 저장하도록 유령 엣지 검증 로직 추가)
        Set<String> validBlockIds = blockRepository.findByProjectIdAndIsDeletedFalse(projectId).stream()
                .map(Block::getFrontendId)
                .collect(Collectors.toSet());

        List<Edge> existingEdges = edgeRepository.findByProjectId(projectId);
        Map<String, Edge> edgeMap = existingEdges.stream().collect(Collectors.toMap(Edge::getFrontendId, e -> e));

        if (req.getEdges() != null) {
            for (CanvasDtos.EdgeDto dto : req.getEdges()) {
                // 출발/도착 노드가 실제 존재하는 유효한 노드인지 검증 (없을 경우 DB 저장 스킵하여 유령 엣지 방지)
                if (!validBlockIds.contains(dto.getSourceFrontendId()) || !validBlockIds.contains(dto.getTargetFrontendId())) {
                    log.warn("[Edge Sync Skip] 유효하지 않은 노드 연결 시도 - EdgeId: {}, Source: {}, Target: {}",
                            dto.getFrontendId(), dto.getSourceFrontendId(), dto.getTargetFrontendId());
                    continue;
                }

                Edge edge = edgeMap.get(dto.getFrontendId());
                if (edge == null) {
                    edge = Edge.builder().project(project).frontendId(dto.getFrontendId()).build();
                }
                applyEdgeDto(edge, dto);
                edgeRepository.save(edge);
                edgeMap.remove(dto.getFrontendId());
            }
        }
        List<Edge> edgesToDelete = edgeMap.values().stream().filter(e -> !e.isDeleted()).peek(e -> e.setDeleted(true)).toList();
        edgeRepository.saveAll(edgesToDelete);

        // Yjs 바이너리 스냅샷이 정상 업데이트된 경우에만 CRDT 로그 정리
        if (req.getYjsData() != null && !req.getYjsData().isBlank()) {
            crdtLogRepository.deleteByProjectIdAndCreatedAtBefore(projectId, syncStartTime);
        }
    }

    @Transactional
    public Integer commitVersion(Integer projectId, String commitMessage) {
        Project project = projectRepository.findById(projectId).orElseThrow();
        assertOwner(projectId);

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

        eventPublisher.publishEvent(new VersionCreatedEvent(projectId));

        return nextVersion;
    }

    @Transactional
    public void restoreVersion(Integer projectId, Integer versionNumber) {
        assertOwner(projectId);

        CanvasDtos.SyncRes snapshot = loadVersionCanvas(projectId, versionNumber);

        CanvasDtos.SyncReq restoreReq = new CanvasDtos.SyncReq();
        restoreReq.setBlocks(snapshot.getBlocks());
        restoreReq.setEdges(snapshot.getEdges());
        restoreReq.setYjsData(snapshot.getYjsData());

        syncLiveCanvas(projectId, restoreReq);
        log.info("[Restore] 프로젝트 {}의 라이브 화면이 버전 {} 상태로 덮어씌워졌습니다.", projectId, versionNumber);

        eventPublisher.publishEvent(new ForceReloadEvent(projectId));
    }

    @Transactional(readOnly = true)
    public List<CanvasDtos.VersionDto> getVersionHistory(Integer projectId) {
        assertPartyMember(projectId);
        return versionRepository.findByProjectIdOrderByVersionNumberDesc(projectId).stream()
                .map(v -> new CanvasDtos.VersionDto(v.getVersionNumber(), v.getCommitMessage(), v.getCreatedAt().toString())).toList();
    }

    @Transactional
    public void deleteSpecificVersion(Integer projectId, Integer versionNumber) {
        assertOwner(projectId);
        versionRepository.findByProjectIdAndVersionNumber(projectId, versionNumber).ifPresent(versionRepository::delete);
    }

    private User currentUser() {
        String username = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByUsername(username).orElseThrow();
    }

    private Party getMyPartyInfo(Integer projectId) {
        return partyRepository.findByProjectIdAndUserId(projectId, currentUser().getId()).orElseThrow();
    }

    private void assertPartyMember(Integer projectId) { getMyPartyInfo(projectId); }

    private void assertNotGuest(Integer projectId) {
        if ("GUEST".equals(getMyPartyInfo(projectId).getRole())) throw new RuntimeException("GUEST는 편집 불가");
    }

    private void assertOwner(Integer projectId) {
        if (!"OWNER".equals(getMyPartyInfo(projectId).getRole())) throw new RuntimeException("방장만 가능");
    }

    private CanvasDtos.BlockDto mapBlockToDto(Block block) {
        CanvasDtos.BlockDto dto = new CanvasDtos.BlockDto();
        dto.setFrontendId(block.getFrontendId()); dto.setParentFrontendId(block.getParentFrontendId());
        dto.setType(block.getType()); dto.setName(block.getName());
        dto.setDescription(block.getDescription()); dto.setParameters(block.getParameters());
        dto.setReturnType(block.getReturnType()); dto.setAnnotations(block.getAnnotations());
        dto.setPosX(block.getPosX()); dto.setPosY(block.getPosY());
        dto.setWidth(block.getWidth()); dto.setHeight(block.getHeight());
        dto.setLastUpdatedBy(block.getLastUpdatedBy() != null ? block.getLastUpdatedBy().getId() : null);
        return dto;
    }

    private CanvasDtos.EdgeDto mapEdgeToDto(Edge edge) {
        CanvasDtos.EdgeDto dto = new CanvasDtos.EdgeDto();
        dto.setFrontendId(edge.getFrontendId()); dto.setSourceFrontendId(edge.getSourceFrontendId());
        dto.setTargetFrontendId(edge.getTargetFrontendId()); dto.setSourceHandle(edge.getSourceHandle());
        dto.setTargetHandle(edge.getTargetHandle()); dto.setType(edge.getType());
        dto.setBadgeCount(edge.getBadgeCount());
        dto.setLastUpdatedBy(edge.getLastUpdatedBy() != null ? edge.getLastUpdatedBy().getId() : null);
        return dto;
    }

    private void applyBlockDto(Block block, CanvasDtos.BlockDto dto) {
        block.setDeleted(false); block.setParentFrontendId(dto.getParentFrontendId());
        block.setType(dto.getType()); block.setName(dto.getName());
        block.setDescription(dto.getDescription()); block.setParameters(dto.getParameters());
        block.setReturnType(dto.getReturnType()); block.setAnnotations(dto.getAnnotations());
        block.setPosX(dto.getPosX()); block.setPosY(dto.getPosY());
        block.setWidth(dto.getWidth()); block.setHeight(dto.getHeight());

        if (dto.getLastUpdatedBy() != null) {
            block.setLastUpdatedBy(userRepository.getReferenceById(dto.getLastUpdatedBy()));
        } else {
            block.setLastUpdatedBy(null);
        }
    }

    private void applyEdgeDto(Edge edge, CanvasDtos.EdgeDto dto) {
        edge.setDeleted(false); edge.setSourceFrontendId(dto.getSourceFrontendId());
        edge.setTargetFrontendId(dto.getTargetFrontendId()); edge.setSourceHandle(dto.getSourceHandle());
        edge.setTargetHandle(dto.getTargetHandle()); edge.setType(dto.getType());
        edge.setBadgeCount(dto.getBadgeCount());

        if (dto.getLastUpdatedBy() != null) {
            edge.setLastUpdatedBy(userRepository.getReferenceById(dto.getLastUpdatedBy()));
        } else {
            edge.setLastUpdatedBy(null);
        }
    }

    private List<CanvasDtos.BlockDto> mapBlocksToDto(List<Block> blocks) { return blocks.stream().map(this::mapBlockToDto).toList(); }
    private List<CanvasDtos.EdgeDto> mapEdgesToDto(List<Edge> edges) { return edges.stream().map(this::mapEdgeToDto).toList(); }
}