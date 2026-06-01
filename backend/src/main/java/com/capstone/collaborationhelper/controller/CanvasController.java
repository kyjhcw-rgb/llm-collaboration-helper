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

    // 1. 다이어그램 불러오기 (라이브 최신 상태 or 특정 박제 버전)
    @GetMapping
    public ResponseEntity<CanvasDtos.SyncRes> loadCanvas(
            @PathVariable Integer projectId,
            @RequestParam(required = false) Integer version) {
        if (version != null) {
            return ResponseEntity.ok(canvasService.loadVersionCanvas(projectId, version));
        }
        return ResponseEntity.ok(canvasService.loadLiveCanvas(projectId));
    }

    // 2. 실시간 라이브 동기화 (UPSERT 및 Soft Delete 처리, 버전 증가는 없음)
    @PostMapping("/sync")
    public ResponseEntity<?> syncLiveCanvas(
            @PathVariable Integer projectId,
            @RequestBody CanvasDtos.SyncReq req) {
        canvasService.syncLiveCanvas(projectId, req);
        return ResponseEntity.ok(Map.of("message", "라이브 스냅샷 동기화 완료"));
    }

    // 3. 다이어그램 버전 박제 (Commit)
    @PostMapping("/commit")
    public ResponseEntity<Map<String, Integer>> commitVersion(
            @PathVariable Integer projectId,
            @RequestBody CanvasDtos.CommitReq req) {
        Integer newVersion = canvasService.commitVersion(projectId, req.getCommitMessage());
        return ResponseEntity.ok(Map.of("newVersion", newVersion));
    }

    // 4. 저장된 버전 히스토리 목록 조회
    @GetMapping("/versions")
    public ResponseEntity<List<CanvasDtos.VersionDto>> getVersions(@PathVariable Integer projectId) {
        return ResponseEntity.ok(canvasService.getVersionHistory(projectId));
    }

    // 5. 특정 버전 삭제
    @DeleteMapping
    public ResponseEntity<?> deleteVersion(
            @PathVariable Integer projectId,
            @RequestParam Integer version) {

        canvasService.deleteSpecificVersion(projectId, version);

        return ResponseEntity.ok(Map.of("message", version + " 버전이 성공적으로 삭제되었습니다."));
    }
}