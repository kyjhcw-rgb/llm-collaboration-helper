import copy
import re
from typing import Any, Dict, Optional, Tuple

from pydantic import ValidationError

from agents.tool.models import (
    AddClassArgs,
    AddEdgeArgs,
    AddFolderArgs,
    AddMethodArgs,
    MoveArgs,
    RemoveArgs,
    RemoveEdgeArgs,
    UpdateArgs,
)

ALLOWED_EDGE_KINDS = {"CALL", "INHERIT", "IMPLEMENT"}
UPDATE_FIELDS = {
    "folder": {"name", "description"},
    "class": {"name", "description", "annotations"},
    "method": {"name", "description", "parameters", "returnType"},
}


class ApplyError(Exception):
    pass


def _slug(value: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower())
    return text.strip("_") or "node"


def _index(diagram: dict) -> dict:
    """id -> (kind, node, siblings, parent). parent는 class면 folder, method면 class."""
    found = {}
    for folder in diagram.setdefault("folders", []):
        found[folder["id"]] = ("folder", folder, diagram["folders"], None)
        for cls in folder.setdefault("classes", []):
            found[cls["id"]] = ("class", cls, folder["classes"], folder)
            for method in cls.setdefault("methods", []):
                found[method["id"]] = ("method", method, cls["methods"], cls)
    return found


def _all_ids(diagram: dict) -> set:
    ids = set(_index(diagram))
    ids.update(edge["id"] for edge in diagram.get("edges", []) if edge.get("id"))
    return ids


def _new_id(raw: Optional[str], prefix: str, name: str, used: set) -> str:
    if raw and raw.strip():
        candidate = raw.strip()
        if candidate in used:
            raise ApplyError(f"이미 있는 id입니다: {candidate}")
        return candidate
    base = f"{prefix}{_slug(name)}"
    candidate, n = base, 2
    while candidate in used:
        candidate = f"{base}_{n}"
        n += 1
    return candidate


def _drop_edges(diagram: dict, ids: set) -> None:
    diagram["edges"] = [
        e for e in diagram.get("edges", [])
        if e.get("fromId") not in ids and e.get("to") not in ids
    ]


def _subtree(kind: str, node: dict) -> set:
    ids = {node["id"]}
    if kind == "method":
        return ids
    for cls in ([node] if kind == "class" else node.get("classes", [])):
        ids.add(cls["id"])
        ids.update(m["id"] for m in cls.get("methods", []))
    return ids


def add_folder(diagram: dict, args: AddFolderArgs) -> dict:
    node_id = _new_id(args.id, "folder_", args.name, _all_ids(diagram))
    diagram.setdefault("folders", []).append({
        "id": node_id,
        "name": args.name,
        "description": args.description or "",
        "classes": [],
    })
    return {"ok": True, "id": node_id, "message": f"folder 추가: {node_id}"}


def add_class(diagram: dict, args: AddClassArgs) -> dict:
    loc = _index(diagram).get(args.parentId)
    if not loc or loc[0] != "folder":
        raise ApplyError(f"folder가 없습니다: {args.parentId}")
    node_id = _new_id(args.id, "cls_", args.name, _all_ids(diagram))
    loc[1].setdefault("classes", []).append({
        "id": node_id,
        "name": args.name,
        "description": args.description or "",
        "annotations": args.annotations,
        "methods": [],
    })
    return {"ok": True, "id": node_id, "message": f"class 추가: {node_id}"}


def add_method(diagram: dict, args: AddMethodArgs) -> dict:
    loc = _index(diagram).get(args.parentId)
    if not loc or loc[0] != "class":
        raise ApplyError(f"class가 없습니다: {args.parentId}")
    node_id = _new_id(args.id, "method_", args.name, _all_ids(diagram))
    loc[1].setdefault("methods", []).append({
        "id": node_id,
        "name": args.name,
        "description": args.description or "",
        "parameters": args.parameters,
        "returnType": args.returnType,
    })
    return {"ok": True, "id": node_id, "message": f"method 추가: {node_id}"}


def remove(diagram: dict, args: RemoveArgs) -> dict:
    loc = _index(diagram).get(args.id)
    if not loc:
        raise ApplyError(f"노드가 없습니다: {args.id}")
    kind, node, siblings, _parent = loc
    siblings.remove(node)
    _drop_edges(diagram, _subtree(kind, node))
    return {"ok": True, "id": args.id, "message": f"{kind} 삭제: {args.id}"}


def update(diagram: dict, args: UpdateArgs) -> dict:
    loc = _index(diagram).get(args.id)
    if not loc:
        raise ApplyError(f"노드가 없습니다: {args.id}")
    kind, node, _, _ = loc
    patch = args.model_dump(exclude_none=True, exclude={"id"})
    bad = [k for k in patch if k not in UPDATE_FIELDS[kind]]
    if not patch:
        raise ApplyError("바꿀 필드가 없습니다.")
    if bad:
        raise ApplyError(f"이 노드에 못 쓰는 필드: {', '.join(bad)}")
    node.update(patch)
    return {"ok": True, "id": args.id, "message": f"{kind} 수정: {args.id}"}


def move(diagram: dict, args: MoveArgs) -> dict:
    if args.id == args.parentId:
        raise ApplyError("자기 자신 아래로는 못 옮깁니다.")
    loc = _index(diagram).get(args.id)
    dest = _index(diagram).get(args.parentId)
    if not loc or loc[0] not in {"class", "method"}:
        raise ApplyError(f"옮길 class/method가 없습니다: {args.id}")
    need = "folder" if loc[0] == "class" else "class"
    if not dest or dest[0] != need:
        raise ApplyError(f"{need}가 없습니다: {args.parentId}")
    _kind, node, siblings, parent = loc
    if parent is dest[1]:
        return {"ok": True, "id": args.id, "message": f"이미 그 아래입니다: {args.id}"}
    siblings.remove(node)
    key = "classes" if loc[0] == "class" else "methods"
    dest[1].setdefault(key, []).append(node)
    return {"ok": True, "id": args.id, "message": f"{loc[0]} 이동: {args.id}"}


def add_edge(diagram: dict, args: AddEdgeArgs) -> dict:
    nodes = _index(diagram)
    if args.fromId not in nodes:
        raise ApplyError(f"출발 노드가 없습니다: {args.fromId}")
    if args.to not in nodes:
        raise ApplyError(f"도착 노드가 없습니다: {args.to}")
    kind = args.kind.strip().upper()
    if kind not in ALLOWED_EDGE_KINDS:
        raise ApplyError(f"허용되지 않는 kind입니다: {args.kind}")
    edge_id = _new_id(args.id, "edge_", "edge", _all_ids(diagram))
    diagram.setdefault("edges", []).append({
        "id": edge_id, "fromId": args.fromId, "to": args.to, "kind": kind,
    })
    return {"ok": True, "id": edge_id, "message": f"edge 추가: {edge_id}"}


def remove_edge(diagram: dict, args: RemoveEdgeArgs) -> dict:
    edges = diagram.setdefault("edges", [])
    for i, edge in enumerate(edges):
        if edge.get("id") == args.id:
            edges.pop(i)
            return {"ok": True, "id": args.id, "message": f"edge 삭제: {args.id}"}
    raise ApplyError(f"edge가 없습니다: {args.id}")


_HANDLERS = {
    "add_folder": (AddFolderArgs, add_folder),
    "add_class": (AddClassArgs, add_class),
    "add_method": (AddMethodArgs, add_method),
    "remove": (RemoveArgs, remove),
    "update": (UpdateArgs, update),
    "move": (MoveArgs, move),
    "add_edge": (AddEdgeArgs, add_edge),
    "remove_edge": (RemoveEdgeArgs, remove_edge),
}

TOOL_NAMES = frozenset(_HANDLERS)


def apply_tool(diagram: dict, name: str, args: Dict[str, Any]) -> Tuple[dict, dict]:
    handler = _HANDLERS.get(name)
    if handler is None:
        return diagram, {"ok": False, "error": f"알 수 없는 툴입니다: {name}"}

    model, fn = handler
    try:
        parsed = model.model_validate(args)
        work = copy.deepcopy(diagram)
        return work, fn(work, parsed)
    except (ValidationError, ApplyError) as e:
        return diagram, {"ok": False, "error": str(e)}
