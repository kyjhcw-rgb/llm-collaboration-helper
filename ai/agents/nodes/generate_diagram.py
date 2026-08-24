import json
import logging

from google.genai import types

from agents.states import DiagramAgentState
from core.config import MODEL_ID, client
from schemas.chat import ModifyResponse
from schemas.common import DiagramRes

logger = logging.getLogger(__name__)


def generate_diagram(state: DiagramAgentState) -> DiagramAgentState:
    """Gemini를 호출하여 초기 다이어그램을 생성하거나 기존 다이어그램을 수정한다."""

    instruction = state["system_instruction"]

    if state["validation_error"]:
        instruction += (
            "\n\n"
            "[이전 시도에서 발견된 오류]\n"
            f"{state['validation_error']}\n"
            "위 오류를 반드시 수정하여 전체 결과를 다시 생성하세요."
        )

        logger.info(
            f"다이어그램 자가 수정 루프 진입 "
            f"(재시도: {state['retry_count']})"
        )

    response_schema = (
        DiagramRes
        if state["mode"] == "initial"
        else ModifyResponse
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=state["user_contents"],
            config=types.GenerateContentConfig(
                system_instruction=instruction,
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.2,
            ),
        )

        payload = json.loads(response.text)

        if state["mode"] == "initial":
            state["generated_diagram"] = payload
            state["generated_reply"] = None
        else:
            state["generated_diagram"] = payload.get("diagram")
            state["generated_reply"] = (
                payload.get("reply") or ""
            ).strip()

            if not state["generated_diagram"]:
                state["validation_error"] = (
                    "수정 결과에 diagram이 없습니다."
                )
            elif not state["generated_reply"]:
                state["validation_error"] = (
                    "수정 결과에 reply가 없습니다."
                )

    except Exception as e:
        logger.error(
            f"다이어그램 생성 노드 에러: {str(e)}",
            exc_info=True
        )
        state["generated_diagram"] = None
        state["generated_reply"] = None
        state["validation_error"] = (
            "JSON 생성 또는 파싱에 실패했습니다. "
            "지정된 스키마에 맞춰 다시 생성하세요."
        )

    return state
