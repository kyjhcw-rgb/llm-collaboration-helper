package com.capstone.collaborationhelper.controller;

import com.capstone.collaborationhelper.dto.ProjectDtos.CreateReq;
import com.capstone.collaborationhelper.dto.ProjectDtos.Res;
import com.capstone.collaborationhelper.dto.ProjectDtos.UpdateReq;
import com.capstone.collaborationhelper.service.ProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "프로젝트", description = "조회는 Party 멤버 기준, 생성·수정·삭제는 소유자 기준")
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @Operation(summary = "참여 중인 프로젝트 목록", description = "Party에 속한(본인 user_id인) 모든 프로젝트입니다. 갱신 시각 기준 내림차순입니다.")
    @GetMapping
    public ResponseEntity<List<Res>> listMine() {
        return ResponseEntity.ok(projectService.getlist());
    }

    @Operation(summary = "프로젝트 단건 조회", description = "해당 프로젝트의 Party 멤버만 조회할 수 있습니다.")
    @GetMapping("/{id}")
    public ResponseEntity<Res> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(projectService.getById(id));
    }

    @Operation(summary = "프로젝트 생성", description = "요청한 사용자가 소유자가 되며, OWNER 역할로 Party에도 등록됩니다.")
    @PostMapping
    public ResponseEntity<Res> create(@Valid @RequestBody CreateReq req) {
        return ResponseEntity.ok(projectService.create(req));
    }

    @Operation(summary = "프로젝트 수정", description = "소유자만 수정할 수 있습니다. null이 아닌 필드만 반영됩니다.")
    @PutMapping("/{id}")
    public ResponseEntity<Res> update(@PathVariable Integer id, @RequestBody UpdateReq req) {
        return ResponseEntity.ok(projectService.update(id, req));
    }

    @Operation(summary = "프로젝트 삭제", description = "소유자만 삭제할 수 있습니다. 관련 Party 행도 함께 제거됩니다.")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        projectService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
