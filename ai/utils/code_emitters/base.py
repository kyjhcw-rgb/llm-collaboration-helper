from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Protocol

from schemas.common import ClassNode, FolderNode
from utils.code_path_mapper import ResolvedFile


@dataclass
class ClassRelations:
    extends: List[str] = field(default_factory=list)
    implements: List[str] = field(default_factory=list)
    call_targets: List[str] = field(default_factory=list)


class CodeEmitter(Protocol):
    def emit(
        self,
        resolved: ResolvedFile,
        folder: FolderNode,
        class_node: ClassNode,
        relations: ClassRelations,
    ) -> str:
        ...
