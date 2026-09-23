"""다이어그램 folder/class → 소스 파일 경로 매핑."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from schemas.common import ClassNode, DiagramRes, FolderNode


@dataclass(frozen=True)
class ResolvedFile:
    path: str
    package_name: str
    folder: FolderNode
    class_node: ClassNode


def _sanitize_segment(value: str) -> str:
    text = (value or "").strip().replace("-", "_").replace(" ", "_")
    return text or "unknown"


def _java_package(base_package: str, folder_name: str) -> str:
    base = ".".join(
        part for part in (_sanitize_segment(p) for p in base_package.split("."))
        if part and part != "unknown"
    ) or "com.example"
    folder = _sanitize_segment(folder_name).lower()
    return f"{base}.{folder}"


def _java_path(package_name: str, class_name: str) -> str:
    rel = package_name.replace(".", "/")
    return f"src/main/java/{rel}/{class_name}.java"


def resolve_java_spring(
    diagram: DiagramRes,
    base_package: str = "com.example",
) -> List[ResolvedFile]:
    """Spring/Java 관례로 파일 경로를 만든다."""
    resolved: List[ResolvedFile] = []
    used_paths: Dict[str, int] = {}

    for folder in diagram.folders:
        package_name = _java_package(base_package, folder.name)

        for cls in folder.classes:
            class_name = (cls.name or "").strip() or "Untitled"
            path = _java_path(package_name, class_name)

            if path in used_paths:
                used_paths[path] += 1
                stem = class_name
                path = _java_path(package_name, f"{stem}_{used_paths[path]}")
            else:
                used_paths[path] = 1

            resolved.append(
                ResolvedFile(
                    path=path,
                    package_name=package_name,
                    folder=folder,
                    class_node=cls,
                )
            )

    return resolved


def build_class_index(
    diagram: DiagramRes,
) -> Dict[str, Tuple[FolderNode, ClassNode]]:
    """class id → (folder, class) 조회 테이블."""
    index: Dict[str, Tuple[FolderNode, ClassNode]] = {}
    for folder in diagram.folders:
        for cls in folder.classes:
            if cls.id:
                index[cls.id] = (folder, cls)
    return index
