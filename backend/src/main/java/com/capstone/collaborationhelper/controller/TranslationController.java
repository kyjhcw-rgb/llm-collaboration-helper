package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import com.capstone.collaborationhelper.service.TranslationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "다이어그램 변환", description = "DB ↔ 중첩 트리 JSON (translation)")
@RestController
@RequestMapping("/api/projects/{projectId}/translation")
@RequiredArgsConstructor
public class TranslationController {

    private final TranslationService translationService;

    @Operation(summary = "translation JSON보내기", description = "DB flat을 features ⊃ classes ⊃ methods + edges JSON으로 변환합니다.")
    @GetMapping
    public ResponseEntity<DiagramRes> export(
            @PathVariable Integer projectId,
            @RequestParam(required = false) Integer version) {
        return ResponseEntity.ok(translationService.exportFromDb(projectId, version));
    }

    @Operation(summary = "translation JSON 가져오기", description = "중첩 트리 JSON을 flat으로 펼쳐 라이브 캔버스(DB)에 저장합니다.")
    @PutMapping
    public ResponseEntity<Map<String, String>> importDiagram(
            @PathVariable Integer projectId,
            @RequestBody DiagramRes diagram) {
        translationService.importToDb(projectId, diagram);
        return ResponseEntity.ok(Map.of("message", "translation 다이어그램이 라이브 캔버스에 반영되었습니다."));
    }
}
