package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.code2diagram.CodeToDiagramService;
import com.capstone.collaborationhelper.dto.CodeToDiagramDtos.FromCodeReq;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@Tag(name = "코드 → 다이어그램", description = "공개 GitHub 레포를 클론해 다이어그램 JSON으로 변환합니다. (프로젝트 생성 전 초기 입력용)")
@RestController
@RequestMapping("/api/fromcode")
@RequiredArgsConstructor
public class CodeToDiagramController {

    private final CodeToDiagramService codeToDiagramService;

    @Operation(
            summary = "GitHub 레포 → 다이어그램",
            description = "공개 레포를 shallow clone한 뒤 Java 소스를 파싱해 DiagramRes만 반환합니다. DB/캔버스에는 저장하지 않습니다."
    )
    @PostMapping
    public ResponseEntity<DiagramRes> fromCode(@Valid @RequestBody FromCodeReq req) throws IOException {
        return ResponseEntity.ok(codeToDiagramService.fromGitHubUrl(req.getRepoUrl()));
    }
}
