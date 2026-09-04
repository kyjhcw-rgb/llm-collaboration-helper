import copy
import json
import logging
from typing import List

from google.genai import types
from pydantic import BaseModel, Field

from agents.states import MAX_DIAGRAM_RETRIES, DiagramAgentState
from core.config import MODEL_ID, client

logger = logging.getLogger(__name__)


class ModifyPlan(BaseModel):
    steps: List[str] = Field(
        description=(
            "실행 순서. 한 항목은 툴 하나 분량. "
            "예: cls_auth_service에 logout 메서드 추가"
        )
    )


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
        steps = payload.get("steps") or []

        state["plan_steps"] = [str(step).strip() for step in steps if str(step).strip()]
        state["step_index"] = 0
        state["validation_error"] = None
        state["generated_reply"] = None

        if not state["plan_steps"]:
            state["generated_reply"] = (
                "다이어그램에 반영할 변경이 없습니다."
            )

        logger.info(f"수정 계획 {len(state['plan_steps'])}스텝: {state['plan_steps']}")

    except Exception as e:
        logger.error(f"plan 노드 에러: {str(e)}", exc_info=True)
        state["plan_steps"] = None
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            state["retry_count"] += 1
        state["validation_error"] = (
            "계획을 JSON으로 만들지 못했습니다. 다시 시도하세요."
        )

    return state
