package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.entity.*;
import com.capstone.collaborationhelper.repository.*;
import com.capstone.collaborationhelper.websocket.CrdtWebSocketHandler.ForceReloadEvent;
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

    private final ApplicationEventPublisher eventPublisher; // 직접 의존성 대신 이벤트 발행기 사용

    @Transactional(readOnly = true)
    public CanvasDtos.SyncRes loadLiveCanvas(Integer projectId) {
        assertPartyMember(projectId);
        Project project = projectRepository.findById(projectId).orElseThrow(); // [추가된 부분] 프로젝트 조회
        List<Block> blocks = blockRepository.findByProjectIdAndIsDeletedFalse(projectId);
        List<Edge> edges = edgeRepository.findByProjectIdAndIsDeletedFalse(projectId);

        // DB에 저장된 Yjs Binary를 Base64로 변환하여 전달
        String yjsDataBase64 = project.getCrdtSnapshot() != null ?
                java.util.Base64.getEncoder().encodeToString(project.getCrdtSnapshot()) : null;

        return new CanvasDtos.SyncRes(mapBlocksToDto(blocks), mapEdgesToDto(edges), yjsDataBase64); // [수정된 부분] yjsDataBase64 포함 반환
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

        // 프론트엔드가 보낸 Yjs Binary를 디코딩하여 DB에 저장
        if (req.getYjsData() != null && !req.getYjsData().isBlank()) {
            project.setCrdtSnapshot(java.util.Base64.getDecoder().decode(req.getYjsData()));
        }

        projectRepository.save(project);

        // Block UPSERT
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

        // Edge UPSERT
        List<Edge> existingEdges = edgeRepository.findByProjectId(projectId);
        Map<String, Edge> edgeMap = existingEdges.stream().collect(Collectors.toMap(Edge::getFrontendId, e -> e));

        if (req.getEdges() != null) {
            for (CanvasDtos.EdgeDto dto : req.getEdges()) {
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

        // 누적된 CRDT 로그 삭제
        crdtLogRepository.deleteByProjectIdAndCreatedAtBefore(projectId, syncStartTime);
    }

    // [STEP 3] 영구 버전 박제 (Commit)
    @Transactional
    public Integer commitVersion(Integer projectId, String commitMessage) {
        Project project = projectRepository.findById(projectId).orElseThrow();
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

        return nextVersion;
    }

    // [STEP 4] 방장의 라이브 복원 (Restore)
    @Transactional
    public void restoreVersion(Integer projectId, Integer versionNumber) {
        assertOwner(projectId); // 방장만 복원 가능

        // 1. 과거 버전의 스냅샷 가져오기
        CanvasDtos.SyncRes snapshot = loadVersionCanvas(projectId, versionNumber);

        // 2. 과거 스냅샷 데이터를 Live 도화지에 덮어쓰기 (SyncReq로 변환 후 Sync 진행)
        CanvasDtos.SyncReq restoreReq = new CanvasDtos.SyncReq();
        restoreReq.setBlocks(snapshot.getBlocks());
        restoreReq.setEdges(snapshot.getEdges());
        restoreReq.setYjsData(snapshot.getYjsData());

        syncLiveCanvas(projectId, restoreReq);
        log.info("[Restore] 프로젝트 {}의 라이브 화면이 버전 {} 상태로 덮어씌워졌습니다.", projectId, versionNumber);

        // 현재 접속중인 사용자들에게 강제 새로고침 트리거 전송
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

    // ===============================================
    // 내부 유틸리티
    // ===============================================
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

    // Entity -> DTO, DTO -> Entity 매핑 로직
    private CanvasDtos.BlockDto mapBlockToDto(Block block) {
        CanvasDtos.BlockDto dto = new CanvasDtos.BlockDto();
        dto.setFrontendId(block.getFrontendId()); dto.setParentFrontendId(block.getParentFrontendId());
        dto.setType(block.getType()); dto.setName(block.getName());
        dto.setDescription(block.getDescription()); dto.setParameters(block.getParameters());
        dto.setReturnType(block.getReturnType()); dto.setAnnotations(block.getAnnotations());
        dto.setPosX(block.getPosX()); dto.setPosY(block.getPosY());
        dto.setWidth(block.getWidth()); dto.setHeight(block.getHeight());
        return dto;
    }

    private CanvasDtos.EdgeDto mapEdgeToDto(Edge edge) {
        CanvasDtos.EdgeDto dto = new CanvasDtos.EdgeDto();
        dto.setFrontendId(edge.getFrontendId()); dto.setSourceFrontendId(edge.getSourceFrontendId());
        dto.setTargetFrontendId(edge.getTargetFrontendId()); dto.setSourceHandle(edge.getSourceHandle());
        dto.setTargetHandle(edge.getTargetHandle()); dto.setType(edge.getType());
        dto.setBadgeCount(edge.getBadgeCount());
        return dto;
    }

    private void applyBlockDto(Block block, CanvasDtos.BlockDto dto) {
        block.setDeleted(false); block.setParentFrontendId(dto.getParentFrontendId());
        block.setType(dto.getType()); block.setName(dto.getName());
        block.setDescription(dto.getDescription()); block.setParameters(dto.getParameters());
        block.setReturnType(dto.getReturnType()); block.setAnnotations(dto.getAnnotations());
        block.setPosX(dto.getPosX()); block.setPosY(dto.getPosY());
        block.setWidth(dto.getWidth()); block.setHeight(dto.getHeight());
    }

    private void applyEdgeDto(Edge edge, CanvasDtos.EdgeDto dto) {
        edge.setDeleted(false); edge.setSourceFrontendId(dto.getSourceFrontendId());
        edge.setTargetFrontendId(dto.getTargetFrontendId()); edge.setSourceHandle(dto.getSourceHandle());
        edge.setTargetHandle(dto.getTargetHandle()); edge.setType(dto.getType());
        edge.setBadgeCount(dto.getBadgeCount());
    }

    private List<CanvasDtos.BlockDto> mapBlocksToDto(List<Block> blocks) { return blocks.stream().map(this::mapBlockToDto).toList(); }
    private List<CanvasDtos.EdgeDto> mapEdgesToDto(List<Edge> edges) { return edges.stream().map(this::mapEdgeToDto).toList(); }
}