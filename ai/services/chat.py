import copy
import json

from fastapi import HTTPException
from google.genai import types

from agents.graphs.modify import modify_agent_app
from agents.states import DiagramAgentState
from agents.prompts import (
    chat_system_instruction,
    history_to_contents,
    plan_system_instruction,
)
from core.config import MODEL_ID, client
from core.exceptions import handle_genai_error
from schemas.chat import ChatRequest, ChatResponse, ModifyResponse
from schemas.common import DiagramRes


def ask_about_project(request: ChatRequest) -> ChatResponse:
    diagram_json = json.dumps(
        request.diagram.model_dump(),
        ensure_ascii=False
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=history_to_contents(request.history, request.message),
            config=types.GenerateContentConfig(
                system_instruction=chat_system_instruction(
                    diagram_json,
                    request.projectContext
                )
            )
        )

        return ChatResponse(
            reply=response.text
        )

    except Exception as e:
        handle_genai_error(
            e,
            "프로젝트 챗봇 응답 생성"
        )


def modify_diagram(request: ChatRequest) -> ModifyResponse:
    snapshot = request.diagram.model_dump()
    diagram_json = json.dumps(snapshot, ensure_ascii=False)

    initial_state: DiagramAgentState = {
        "mode": "modify",
        "system_instruction": plan_system_instruction(
            diagram_json,
            request.projectContext
        ),
        "user_contents": history_to_contents(
            request.history,
            request.message
        ),
        "validation_error": None,
        "retry_count": 0,
        "generated_diagram": copy.deepcopy(snapshot),
        "original_diagram": copy.deepcopy(snapshot),
        "generated_reply": None,
        "plan_steps": None,
        "step_index": 0,
        "project_context": request.projectContext,
    }

    try:
        result = modify_agent_app.invoke(
            initial_state
        )

        if not result.get("generated_diagram"):
            raise HTTPException(
                status_code=502,
                detail="AI가 수정된 다이어그램을 반환하지 않았습니다."
            )

        if not result.get("generated_reply"):
            raise HTTPException(
                status_code=502,
                detail="AI가 변경 설명(reply)을 반환하지 않았습니다."
            )

        return ModifyResponse(
            reply=result["generated_reply"].strip(),
            diagram=DiagramRes(**result["generated_diagram"])
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            "다이어그램 수정"
        )
