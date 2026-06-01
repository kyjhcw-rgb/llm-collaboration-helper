package com.capstone.collaborationhelper.service;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.capstone.collaborationhelper.mapper.TranslationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * DB(캔버스 flat) ↔ translation 중첩 트리(JSON) 오케스트레이션.
 */
@Service
@RequiredArgsConstructor
public class TranslationService {

    private final CanvasService canvasService;
    private final TranslationMapper translationMapper;

    @Transactional(readOnly = true)
    public DiagramRes exportFromDb(Integer projectId, Integer version) {
        CanvasDtos.SyncRes canvas = version != null
                ? canvasService.loadVersionCanvas(projectId, version)
                : canvasService.loadLiveCanvas(projectId);
        return translationMapper.fromCanvasSync(canvas.getBlocks(), canvas.getEdges());
    }

    @Transactional
    public void importToDb(Integer projectId, DiagramRes diagram) {
        CanvasDtos.SyncReq syncReq = translationMapper.toCanvasSync(diagram);
        canvasService.syncLiveCanvas(projectId, syncReq);
    }
}
