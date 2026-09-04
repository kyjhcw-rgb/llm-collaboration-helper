import json

from fastapi import HTTPException

from agents.graphs.code import code_agent_app
from agents.graphs.diagram import diagram_agent_app
from agents.states import CodeGenerationState, DiagramAgentState
from agents.prompts import (
    INITIAL_DIAGRAM_SYSTEM,
    file_tree_system_instruction,
    file_tree_user_message,
    initial_diagram_user_message,
    single_code_system_instruction,
    single_code_user_message,
)
from core.exceptions import handle_genai_error
from schemas.common import DiagramRes
from schemas.project import (
    DiagramGenerationRequest,
    FileStructureResponse,
    FileTreeRequest,
    SingleCodeGenerationRequest,
    SingleCodeGenerationResponse,
)


def generate_initial_diagram(request: DiagramGenerationRequest) -> DiagramRes:
    initial_state: DiagramAgentState = {
        "mode": "initial",
        "system_instruction": INITIAL_DIAGRAM_SYSTEM,
        "user_contents": [initial_diagram_user_message(request)],
        "validation_error": None,
        "retry_count": 0,
        "generated_diagram": None,
        "original_diagram": None,
        "generated_reply": None,
        "plan_steps": None,
        "step_index": 0,
        "project_context": None,
    }

    try:
        result = diagram_agent_app.invoke(
            initial_state
        )

        if not result.get("generated_diagram"):
            raise HTTPException(
                status_code=502,
                detail="AI가 다이어그램을 생성하지 못했습니다."
            )

        return DiagramRes(**result["generated_diagram"])

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            "다이어그램 초기 생성"
        )


def generate_file_tree(request: FileTreeRequest) -> FileStructureResponse:
    diagram_json = json.dumps(
        request.diagram.model_dump(),
        ensure_ascii=False
    )

    initial_state: CodeGenerationState = {
        "mode": "file_tree",
        "system_instruction": file_tree_system_instruction(
            request.targetFramework
        ),
        "user_contents": [file_tree_user_message(diagram_json)],
        "target_file_path": None,
        "result": None,
        "validation_error": None,
        "retry_count": 0
    }

    try:
        result = code_agent_app.invoke(
            initial_state
        )

        if not result.get("result"):
            raise HTTPException(
                status_code=502,
                detail="파일 트리 생성에 실패했습니다."
            )

        return FileStructureResponse(
            **result["result"]
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            "파일 트리 생성"
        )


def generate_single_code(
    request: SingleCodeGenerationRequest
) -> SingleCodeGenerationResponse:
    diagram_json = json.dumps(
        request.diagram.model_dump(),
        ensure_ascii=False
    )

    initial_state: CodeGenerationState = {
        "mode": "single_code",
        "system_instruction": single_code_system_instruction(
            request.targetFilePath
        ),
        "user_contents": [
            single_code_user_message(
                diagram_json,
                request.targetFilePath,
                request.targetFramework
            )
        ],
        "target_file_path": request.targetFilePath,
        "result": None,
        "validation_error": None,
        "retry_count": 0
    }

    try:
        result = code_agent_app.invoke(
            initial_state
        )

        if not result.get("result"):
            raise HTTPException(
                status_code=502,
                detail=(
                    f"[{request.targetFilePath}] "
                    "코드 생성에 실패했습니다."
                )
            )

        return SingleCodeGenerationResponse(
            **result["result"]
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            f"[{request.targetFilePath}] 단일 코드 생성"
        )
