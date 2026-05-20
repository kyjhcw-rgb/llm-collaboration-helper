package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.CanvasDtos;
import com.capstone.collaborationhelper.service.CanvasService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects/{projectId}/canvas")
@RequiredArgsConstructor
public class CanvasController {
    private final CanvasService canvasService;

    // [R] 1. 다이어그램 불러오기 (Read - 최신 또는 특정 버전)
    @GetMapping
    public ResponseEntity<CanvasDtos.SyncRes> loadCanvas(
            @PathVariable Integer projectId,
            @RequestParam(required = false) Integer version) {
        return ResponseEntity.ok(canvasService.loadCanvas(projectId, version));
    }

    // [C/U/D] 2. 다이어그램 저장 (새로운 버전 스냅샷 생성)
    @PostMapping("/sync")
    public ResponseEntity<CanvasDtos.SaveRes> syncCanvas(
            @PathVariable Integer projectId,
            @RequestBody CanvasDtos.SyncReq req) {
        Integer newVersion = canvasService.syncCanvasAndCreateNewVersion(projectId, req);
        return ResponseEntity.ok(new CanvasDtos.SaveRes(newVersion));
    }

    // [R] 3. 다이어그램 저장된 버전 히스토리 목록 조회
    @GetMapping("/versions")
    public ResponseEntity<List<Integer>> getVersions(@PathVariable Integer projectId) {
        return ResponseEntity.ok(canvasService.getAvailableVersions(projectId));
    }

    // [D] 4. 특정 다이어그램 버전 완전 삭제
    @DeleteMapping
    public ResponseEntity<?> deleteVersion(
            @PathVariable Integer projectId,
            @RequestParam Integer version) {
        canvasService.deleteSpecificVersion(projectId, version);
        return ResponseEntity.ok(Map.of("message", version + " 버전이 성공적으로 삭제되었습니다."));
    }
}