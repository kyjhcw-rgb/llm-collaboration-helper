package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.service.FoundationCodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "파운데이션 코드", description = "다이어그램 → 스켈레톤 소스 zip")
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class FoundationCodeController {

    private final FoundationCodeService foundationCodeService;

    @Operation(
            summary = "파운데이션 코드 추출",
            description = "DB live 다이어그램을 AI diagram-to-code로 변환해 zip으로 반환합니다. 요청 body 없음."
    )
    @PostMapping("/{projectId}/foundation-code")
    public ResponseEntity<byte[]> downloadFoundationCode(@PathVariable Integer projectId) {
        byte[] zip = foundationCodeService.buildZip(projectId);
        String filename = foundationCodeService.zipFileName(projectId);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(zip);
    }
}
