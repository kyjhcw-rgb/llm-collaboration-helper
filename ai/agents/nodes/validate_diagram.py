import logging
import re
from typing import List

from schemas.common import DiagramRes

from agents.states import MAX_DIAGRAM_RETRIES, DiagramAgentState

logger = logging.getLogger(__name__)

ALLOWED_EDGE_KINDS = {"CALL", "INHERIT", "IMPLEMENT"}


def _valid_node_ids(diagram: dict) -> set:
    valid_ids = set()

    for feature in diagram.get("features", []):
        if feature.get("id"):
            valid_ids.add(feature["id"])

        for cls in feature.get("classes", []):
            if cls.get("id"):
                valid_ids.add(cls["id"])

            for method in cls.get("methods", []):
                if method.get("id"):
                    valid_ids.add(method["id"])

    return valid_ids


def _slug(value: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower())
    return text.strip("_") or "node"


def _unique_id(prefix: str, name: str, used: set) -> str:
    base = f"{prefix}{_slug(name)}"
    candidate = base
    suffix = 2

    while candidate in used:
        candidate = f"{base}_{suffix}"
        suffix += 1

    used.add(candidate)
    return candidate


def _fill_missing_node_ids(diagram: dict) -> dict:
    """id가 없는 블록에만 고유 키를 부여한다. 기존 id는 건드리지 않는다."""
    used = _valid_node_ids(diagram)

    for feature in diagram.get("features", []):
        if not feature.get("id"):
            feature["id"] = _unique_id("feat_", feature.get("name") or "", used)
            logger.warning(f"feature에 id가 없어 부여했습니다: {feature['id']}")

        for cls in feature.get("classes", []):
            if not cls.get("id"):
                cls["id"] = _unique_id("cls_", cls.get("name") or "", used)
                logger.warning(f"class에 id가 없어 부여했습니다: {cls['id']}")

            for method in cls.get("methods", []):
                if not method.get("id"):
                    method["id"] = _unique_id(
                        "method_",
                        method.get("name") or "",
                        used
                    )
                    logger.warning(
                        f"method에 id가 없어 부여했습니다: {method['id']}"
                    )

    return diagram


def _fill_missing_edge_ids(diagram: dict) -> dict:
    used = _valid_node_ids(diagram)

    for edge in diagram.get("edges", []):
        if edge.get("id"):
            used.add(edge["id"])

    seq = 1
    for edge in diagram.get("edges", []):
        if edge.get("id"):
            continue

        candidate = f"edge_{seq}"
        while candidate in used:
            seq += 1
            candidate = f"edge_{seq}"

        edge["id"] = candidate
        used.add(candidate)
        seq += 1
        logger.warning(f"edge에 id가 없어 부여했습니다: {edge['id']}")

    return diagram


def _repair_edges(diagram: dict) -> dict:
    """유령 edge와 허용되지 않는 kind edge를 제거한다."""
    valid_ids = _valid_node_ids(diagram)
    clean_edges = []

    for edge in diagram.get("edges", []):
        kind = edge.get("kind")
        if isinstance(kind, str):
            kind = kind.strip().upper()
        else:
            kind = None

        if kind not in ALLOWED_EDGE_KINDS:
            logger.warning(
                f"허용되지 않는 kind edge를 제거했습니다: "
                f"{edge.get('id')} kind={edge.get('kind')}"
            )
            continue

        from_id = edge.get("fromId")
        to_id = edge.get("to")

        if from_id not in valid_ids or to_id not in valid_ids:
            logger.warning(
                f"유령 엣지가 감지되어 제거되었습니다: {edge.get('id')}"
            )
            continue

        edge["kind"] = kind
        clean_edges.append(edge)

    diagram["edges"] = clean_edges
    return diagram


def _structural_errors(diagram: dict) -> List[str]:
    """자동 수리 뒤에 남는 문제(id 중복)만 수집한다."""
    ids = []

    for feature in diagram.get("features", []):
        if feature.get("id"):
            ids.append(feature["id"])

        for cls in feature.get("classes", []):
            if cls.get("id"):
                ids.append(cls["id"])

            for method in cls.get("methods", []):
                if method.get("id"):
                    ids.append(method["id"])

    duplicates = sorted({x for x in ids if ids.count(x) > 1})
    if not duplicates:
        return []

    return [f"중복된 node ID가 존재합니다: {', '.join(duplicates)}"]


def _finalize_diagram(diagram: dict) -> dict:
    DiagramRes(**diagram)
    return diagram


def validate_diagram(state: DiagramAgentState) -> DiagramAgentState:
    """생성된 다이어그램의 구조와 edge 무결성을 검사한다."""

    generated = state.get("generated_diagram")

    if not generated:
        if not state.get("validation_error"):
            state["validation_error"] = (
                "생성된 다이어그램이 없습니다."
            )
        return state

    generated = _fill_missing_node_ids(generated)
    generated = _repair_edges(generated)
    generated = _fill_missing_edge_ids(generated)

    try:
        structural_errors = _structural_errors(generated)
    except Exception as e:
        structural_errors = [
            f"다이어그램 검증 중 오류가 발생했습니다: {str(e)}"
        ]

    if structural_errors and state["retry_count"] < MAX_DIAGRAM_RETRIES:
        state["validation_error"] = "\n".join(
            structural_errors
        )
        state["retry_count"] += 1

        logger.warning(
            "다이어그램 검증 실패. 재생성합니다. "
            f"retry={state['retry_count']}, "
            f"errors={structural_errors}"
        )

        return state

    if structural_errors:
        logger.warning(
            "최대 재시도 횟수를 초과했습니다. "
            "중복 id는 수정하지 못한 채 결과를 반환합니다."
        )

    try:
        state["generated_diagram"] = _finalize_diagram(
            generated
        )
        state["validation_error"] = None
    except Exception as e:
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            state["validation_error"] = (
                f"최종 Pydantic 검증 실패: {str(e)}"
            )
            state["retry_count"] += 1
        else:
            state["validation_error"] = None
            state["generated_diagram"] = generated

    return state
