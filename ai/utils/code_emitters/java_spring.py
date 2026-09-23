"""DiagramRes class 노드 → Java/Spring 스켈레톤 소스."""

from __future__ import annotations

from typing import List, Optional

from schemas.common import ClassNode, FolderNode, MethodNode
from utils.code_emitters.base import ClassRelations
from utils.code_path_mapper import ResolvedFile


def _split_annotations(raw: Optional[str]) -> List[str]:
    if not raw or not raw.strip():
        return []
    parts = []
    for token in raw.replace(",", " ").split():
        token = token.strip()
        if not token:
            continue
        if not token.startswith("@"):
            token = f"@{token}"
        parts.append(token)
    return parts


def _default_return_expr(return_type: Optional[str]) -> str:
    if not return_type or return_type.strip() in {"void", "Void"}:
        return ""
    rt = return_type.strip()
    if rt in {"int", "long", "short", "byte"}:
        return "return 0;"
    if rt in {"float", "double"}:
        return "return 0.0;"
    if rt in {"boolean", "Boolean"}:
        return "return false;"
    if rt in {"char"}:
        return "return '\\0';"
    return "return null;"


def _method_stub(method: MethodNode) -> str:
    params = (method.parameters or "").strip()
    return_type = (method.returnType or "void").strip() or "void"
    name = (method.name or "untitled").strip() or "untitled"
    desc = (method.description or "").strip()

    lines = [
        "    /**",
        f"     * {desc}" if desc else "     * TODO: implement",
        "     */",
        f"    public {return_type} {name}({params}) {{",
    ]
    if desc:
        lines.append(f"        // TODO: {desc}")
    else:
        lines.append("        // TODO: implement")

    ret = _default_return_expr(return_type)
    if ret:
        lines.append(f"        {ret}")
    lines.append("    }")
    return "\n".join(lines)


class JavaSpringEmitter:
    def emit(
        self,
        resolved: ResolvedFile,
        folder: FolderNode,
        class_node: ClassNode,
        relations: ClassRelations,
    ) -> str:
        class_name = (class_node.name or "Untitled").strip() or "Untitled"
        class_desc = (class_node.description or folder.description or "").strip()

        lines: List[str] = [
            f"package {resolved.package_name};",
            "",
        ]

        if relations.call_targets:
            lines.append("// Related (CALL) types from diagram:")
            for target in relations.call_targets:
                lines.append(f"// - {target}")
            lines.append("")

        if class_desc:
            lines.append("/**")
            lines.append(f" * {class_desc}")
            lines.append(" */")

        for ann in _split_annotations(class_node.annotations):
            lines.append(ann)

        header = f"public class {class_name}"
        if relations.extends:
            header += f" extends {relations.extends[0]}"
        if relations.implements:
            header += " implements " + ", ".join(relations.implements)
        header += " {"
        lines.append(header)
        lines.append("")

        if not class_node.methods:
            lines.append("    // No methods defined in diagram")
            lines.append("")
        else:
            for method in class_node.methods:
                lines.append(_method_stub(method))
                lines.append("")

        lines.append("}")
        lines.append("")
        return "\n".join(lines)
