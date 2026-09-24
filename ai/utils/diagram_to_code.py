"""DiagramRes → 스켈레톤 소스 코드 (LLM 없음)."""

from __future__ import annotations

from typing import Dict, List

from fastapi import HTTPException

from schemas.common import DiagramRes
from utils.code_emitters import get_emitter
from utils.code_emitters.base import ClassRelations
from utils.code_path_mapper import (
    ResolvedFile,
    build_class_index,
    resolve_java_spring,
)


def _build_relations(
    diagram: DiagramRes,
    class_id: str,
    class_index: dict,
) -> ClassRelations:
    extends: List[str] = []
    implements: List[str] = []
    call_targets: List[str] = []

    def resolve_name(node_id: str) -> str | None:
        hit = class_index.get(node_id)
        if hit:
            return hit[1].name
        # method id면 소속 class를 찾아본다
        for folder in diagram.folders:
            for cls in folder.classes:
                for method in cls.methods:
                    if method.id == node_id:
                        return cls.name
        return None

    for edge in diagram.edges:
        kind = (edge.kind or "").strip().upper()
        if edge.fromId != class_id and not _edge_from_class_method(
            diagram, class_id, edge.fromId
        ):
            continue

        target_name = resolve_name(edge.to)
        if not target_name:
            continue

        if kind == "INHERIT" and target_name not in extends:
            extends.append(target_name)
        elif kind == "IMPLEMENT" and target_name not in implements:
            implements.append(target_name)
        elif kind == "CALL" and target_name not in call_targets:
            call_targets.append(target_name)

    return ClassRelations(
        extends=extends,
        implements=implements,
        call_targets=call_targets,
    )


def _edge_from_class_method(
    diagram: DiagramRes,
    class_id: str,
    from_id: str,
) -> bool:
    for folder in diagram.folders:
        for cls in folder.classes:
            if cls.id != class_id:
                continue
            return any(m.id == from_id for m in cls.methods)
    return False


def convert_diagram_to_code(
    diagram: DiagramRes,
    target_framework: str,
    base_package: str = "com.example",
) -> Dict[str, str]:
    """다이어그램을 프레임워크별 스켈레톤 파일 맵으로 변환한다."""
    try:
        emitter = get_emitter(target_framework)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not diagram.folders:
        return {}

    resolved_files: List[ResolvedFile] = resolve_java_spring(
        diagram, base_package=base_package
    )
    class_index = build_class_index(diagram)
    files: Dict[str, str] = {}

    for item in resolved_files:
        relations = _build_relations(
            diagram, item.class_node.id, class_index
        )
        files[item.path] = emitter.emit(
            item,
            item.folder,
            item.class_node,
            relations,
        )

    return files
