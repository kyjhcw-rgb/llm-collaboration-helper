import json
import logging

from google.genai import types

from agents.states import CodeGenerationState
from core.config import MODEL_ID, client
from schemas.project import FileStructureResponse, SingleCodeGenerationResponse

logger = logging.getLogger(__name__)


def generate_code(state: CodeGenerationState) -> CodeGenerationState:
    """파일 트리 또는 단일 소스 코드를 생성한다."""

    instruction = state["system_instruction"]

    if state["validation_error"]:
        instruction += (
            "\n\n"
            "[이전 생성 오류]\n"
            f"{state['validation_error']}\n"
            "오류를 수정하여 다시 생성하세요."
        )

    if state["mode"] == "file_tree":
        response_schema = FileStructureResponse
    else:
        response_schema = SingleCodeGenerationResponse

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=state["user_contents"],
            config=types.GenerateContentConfig(
                system_instruction=instruction,
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=(
                    0.1 if state["mode"] == "file_tree"
                    else 0.3
                ),
            ),
        )

        payload = json.loads(response.text)

        if state["mode"] == "file_tree":
            if not isinstance(
                payload.get("filePaths"),
                dict
            ):
                raise ValueError(
                    "filePaths가 dictionary가 아닙니다."
                )
        else:
            if not payload.get("filePath"):
                raise ValueError(
                    "filePath가 없습니다."
                )

            if "code" not in payload:
                raise ValueError(
                    "code가 없습니다."
                )

            expected_path = state.get("target_file_path")
            actual_path = payload.get("filePath")

            if expected_path and actual_path != expected_path:
                raise ValueError(
                    f"요청한 파일 [{expected_path}]과 "
                    f"응답 파일 [{actual_path}]이 다릅니다."
                )

        state["result"] = payload
        state["validation_error"] = None

    except Exception as e:
        logger.error(
            f"코드 생성 노드 에러: {str(e)}",
            exc_info=True
        )

        state["result"] = None
        state["validation_error"] = str(e)

    return state
