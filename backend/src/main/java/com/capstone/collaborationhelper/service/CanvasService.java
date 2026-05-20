package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.entity.Block;
import com.capstone.collaborationhelper.entity.Edge;
import com.capstone.collaborationhelper.entity.Project;
import com.capstone.collaborationhelper.repository.BlockRepository;
import com.capstone.collaborationhelper.repository.EdgeRepository;
import com.capstone.collaborationhelper.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CanvasService {
    private final ProjectRepository projectRepository;
    private final BlockRepository blockRepository;
    private final EdgeRepository edgeRepository;

    // [Read] 1. 다이어그램 특정 버전 불러오기
    @Transactional(readOnly = true)
    public CanvasDtos.SyncRes loadCanvas(Integer projectId, Integer requestedVersion) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 프로젝트입니다."));

        Integer versionToLoad = (requestedVersion != null) ? requestedVersion : project.getVersion();

        List<Block> blocks = blockRepository.findByProjectIdAndVersion(projectId, versionToLoad);
        List<Edge> edges = edgeRepository.findByProjectIdAndVersion(projectId, versionToLoad);

        List<CanvasDtos.BlockDto> blockDtos = blocks.stream().map(b -> {
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

        List<CanvasDtos.EdgeDto> edgeDtos = edges.stream().map(e -> {
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

        return new CanvasDtos.SyncRes(versionToLoad, blockDtos, edgeDtos);
    }

    // [Create/Update/Delete] 2. 다이어그램 변경사항을 '새 버전'으로 스냅샷 저장
    @Transactional
    public Integer syncCanvasAndCreateNewVersion(Integer projectId, CanvasDtos.SyncReq req) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 프로젝트입니다."));

        // 버전 번호 증가
        int newVersion = project.getVersion() + 1;
        project.setVersion(newVersion);
        projectRepository.save(project);

        // 프론트엔드에서 누락(Delete)되거나 수정(Update)되거나 추가(Create)된 최종 상태를 통째로 Insert
        if (req.getBlocks() != null && !req.getBlocks().isEmpty()) {
            List<Block> newBlocks = req.getBlocks().stream().map(dto ->
                    Block.builder()
                            .project(project)
                            .version(newVersion)
                            .frontendId(dto.getFrontendId())
                            .parentFrontendId(dto.getParentFrontendId())
                            .type(dto.getType())
                            .name(dto.getName())
                            .description(dto.getDescription())
                            .parameters(dto.getParameters())
                            .returnType(dto.getReturnType())
                            .annotations(dto.getAnnotations())
                            .posX(dto.getPosX())
                            .posY(dto.getPosY())
                            .build()
            ).collect(Collectors.toList());
            blockRepository.saveAll(newBlocks);
        }

        if (req.getEdges() != null && !req.getEdges().isEmpty()) {
            List<Edge> newEdges = req.getEdges().stream().map(dto ->
                    Edge.builder()
                            .project(project)
                            .version(newVersion)
                            .frontendId(dto.getFrontendId())
                            .sourceFrontendId(dto.getSourceFrontendId())
                            .targetFrontendId(dto.getTargetFrontendId())
                            .sourceHandle(dto.getSourceHandle())
                            .targetHandle(dto.getTargetHandle())
                            .type(dto.getType())
                            .badgeCount(dto.getBadgeCount())
                            .build()
            ).collect(Collectors.toList());
            edgeRepository.saveAll(newEdges);
        }

        return newVersion;
    }

    // [Read] 3. 이 프로젝트에 저장된 '버전 목록' 조회 (예: 히스토리 복원 기능에 사용)
    @Transactional(readOnly = true)
    public List<Integer> getAvailableVersions(Integer projectId) {
        return blockRepository.findAvailableVersions(projectId);
    }

    // [Delete] 4. 특정 과거 버전의 다이어그램 영구 삭제 (잘못 저장했거나 용량 정리 시)
    @Transactional
    public void deleteSpecificVersion(Integer projectId, Integer version) {
        // 해당 버전의 블록과 엣지만 데이터베이스에서 날림
        edgeRepository.deleteByProjectIdAndVersion(projectId, version);
        blockRepository.deleteByProjectIdAndVersion(projectId, version);
    }
}