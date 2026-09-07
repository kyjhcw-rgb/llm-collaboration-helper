import copy
import json
import logging
from typing import Any, Dict, List, Literal, Optional

from google.genai import types
from pydantic import BaseModel, Field

from agents.states import MAX_DIAGRAM_RETRIES, DiagramAgentState
from agents.tool.apply import TOOL_NAMES
from core.config import MODEL_ID, client

logger = logging.getLogger(__name__)

PlanToolName = Literal[
    "add_folder",
    "add_class",
    "add_method",
    "remove",
    "update",
    "move",
    "add_edge",
    "remove_edge",
]


class PlannedStep(BaseModel):
    tool: PlanToolName = Field(description="실행할 툴 이름")
    args: Dict[str, Any] = Field(
        default_factory=dict,
        description="해당 툴 인자. 예: add_method면 parentId, name",
    )


class ModifyPlan(BaseModel):
    steps: List[PlannedStep] = Field(
        default_factory=list,
        description="실행 순서. 한 항목은 툴 하나.",
    )


def _normalize_steps(raw: Optional[list]) -> List[dict]:
    steps = []
    for item in raw or []:
        if isinstance(item, PlannedStep):
            tool, args = item.tool, item.args or {}
        elif isinstance(item, dict):
            tool, args = item.get("tool"), item.get("args") or {}
        else:
            continue
        if tool not in TOOL_NAMES or not isinstance(args, dict):
            continue
        steps.append({"tool": tool, "args": args})
    return steps


def plan_diagram(state: DiagramAgentState) -> DiagramAgentState:
    """수정 요청을 툴 단위 스텝 목록으로 쪼갠다. 다이어그램은 바꾸지 않는다."""

    original = state.get("original_diagram")
    if original:
        state["generated_diagram"] = copy.deepcopy(original)

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=state["user_contents"],
            config=types.GenerateContentConfig(
                system_instruction=state["system_instruction"],
                response_mime_type="application/json",
                response_schema=ModifyPlan,
                temperature=0.2,
            ),
        )

        payload = json.loads(response.text)
        raw_steps = payload.get("steps") or []
        steps = _normalize_steps(raw_steps)

        if raw_steps and not steps:
            raise ValueError("계획 스텝을 툴 호출로 해석하지 못했습니다.")

        state["plan_steps"] = steps
        state["step_index"] = 0
        state["validation_error"] = None
        state["generated_reply"] = None

        if not steps:
            state["generated_reply"] = (
                "다이어그램에 반영할 변경이 없습니다."
            )

        logger.info(f"수정 계획 {len(steps)}스텝: {steps}")

    except Exception as e:
        logger.error(f"plan 노드 에러: {str(e)}", exc_info=True)
        state["plan_steps"] = None
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            state["retry_count"] += 1
        state["validation_error"] = (
            "계획을 JSON으로 만들지 못했습니다. 다시 시도하세요."
        )

    return state
