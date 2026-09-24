from fastapi import HTTPException

from agents.graphs.diagram import diagram_agent_app
from agents.prompts import (
    INITIAL_DIAGRAM_SYSTEM,
    initial_diagram_user_message,
)
from core.exceptions import handle_genai_error
from schemas.common import DiagramRes
from schemas.project import (
    DiagramGenerationRequest,
    DiagramToCodeRequest,
    DiagramToCodeResponse,
)
from utils.diagram_helper import build_diagram_agent_state
from utils.diagram_to_code import convert_diagram_to_code


def generate_initial_diagram(request: DiagramGenerationRequest) -> DiagramRes:
    initial_state = build_diagram_agent_state(
        mode="initial",
        system_instruction=INITIAL_DIAGRAM_SYSTEM,
        user_contents=[initial_diagram_user_message(request)]
    )

    try:
        result = diagram_agent_app.invoke(initial_state)

        if not result.get("generated_diagram"):
            raise HTTPException(
                status_code=502,
                detail="AI가 다이어그램을 생성하지 못했습니다."
            )

        return DiagramRes(**result["generated_diagram"])

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(e, "다이어그램 초기 생성")


def generate_code_from_diagram(
    request: DiagramToCodeRequest,
) -> DiagramToCodeResponse:
    files = convert_diagram_to_code(
        diagram=request.diagram,
        target_framework=request.targetFramework,
        base_package=request.basePackage,
    )

    if not files:
        raise HTTPException(
            status_code=400,
            detail="변환할 클래스 노드가 다이어그램에 없습니다.",
        )

    return DiagramToCodeResponse(files=files)
