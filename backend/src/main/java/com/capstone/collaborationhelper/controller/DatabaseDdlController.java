package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.service.DatabaseDdlService;
import com.capstone.collaborationhelper.service.DatabaseDdlService.DdlFile;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "DDL 생성", description = "다이어그램 → DDL .sql")
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class DatabaseDdlController {

    private final DatabaseDdlService databaseDdlService;

    @Operation(
            summary = "DDL SQL 추출",
            description = "DB live 다이어그램을 AI generate-database-ddl로 변환해 .sql 파일로 반환합니다. body 없음."
    )
    @PostMapping("/{projectId}/database-ddl")
    public ResponseEntity<byte[]> downloadDatabaseDdl(
            @PathVariable Integer projectId,
            @RequestParam(defaultValue = "mysql") String dbType) {

        DdlFile file = databaseDdlService.buildSqlFile(projectId, dbType);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.filename() + "\"")
                .contentType(MediaType.parseMediaType("application/sql"))
                .body(file.content());
    }
}
