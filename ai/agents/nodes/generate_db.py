import json
import logging

from google.genai import types

from agents.states import CodeGenerationState
from core.config import MODEL_ID, client
from schemas.database import DatabaseDDLResponse

logger = logging.getLogger(__name__)


def generate_db(state: CodeGenerationState) -> CodeGenerationState:
    """다이어그램 구조를 분석하여 선택한 DB의 DDL SQL을 생성한다."""

    instruction = state["system_instruction"]

    # 이전 검증 단계에서 에러가 있었을 경우 재시도 프롬프트 보강
    if state.get("validation_error"):
        instruction += (
            "\n\n"
            "[이전 생성 오류]\n"
            f"{state['validation_error']}\n"
            "위 오류를 수정하여 올바른 DDL SQL과 요약을 다시 생성하세요."
        )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=state["user_contents"],
            config=types.GenerateContentConfig(
                system_instruction=instruction,
                response_mime_type="application/json",
                response_schema=DatabaseDDLResponse,
                temperature=0.1,
            ),
        )

        payload = json.loads(response.text)

        if "sql" not in payload:
            raise ValueError("응답 결과에 'sql' 필드가 없습니다.")

        state["result"] = payload
        state["validation_error"] = None

    except Exception as e:
        logger.error(f"DB DDL 생성 노드 에러: {str(e)}", exc_info=True)
        state["result"] = None
        state["validation_error"] = str(e)

    return state