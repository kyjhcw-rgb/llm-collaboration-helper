import copy
from fastapi import HTTPException
from google.genai import types

from agents.graphs.modify import modify_agent_app
from agents.prompts import (
    chat_system_instruction,
    history_to_contents,
    plan_system_instruction,
)
from core.config import MODEL_ID, client
from core.exceptions import handle_genai_error
from schemas.chat import ChatRequest, ChatResponse, ModifyResponse
from schemas.common import DiagramRes
from utils.diagram_helper import serialize_diagram, build_diagram_agent_state


def ask_about_project(request: ChatRequest) -> ChatResponse:
    diagram_json = serialize_diagram(request.diagram)

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

        return ChatResponse(reply=response.text)

    except Exception as e:
        handle_genai_error(e, "프로젝트 챗봇 응답 생성")


def modify_diagram(request: ChatRequest) -> ModifyResponse:
    diagram_json = serialize_diagram(request.diagram)

    initial_state = build_diagram_agent_state(
        mode="modify",
        system_instruction=plan_system_instruction(diagram_json, request.projectContext),
        user_contents=history_to_contents(request.history, request.message),
        diagram=request.diagram,
        project_context=request.projectContext
    )

    try:
        result = modify_agent_app.invoke(initial_state)

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
        handle_genai_error(e, "다이어그램 수정")

def analyze_and_upgrade_diagram(
    request: BenchmarkAnalysisRequest
) -> BenchmarkAnalysisResponse:
    """유사 서비스를 분석하고 다이어그램 구조 개선안을 제안 및 자동 반영합니다."""
    diagram_json = serialize_diagram(request.diagram)
    
    user_prompt = (
        "현재 다이어그램 구조를 분석하여 시중의 유사 서비스와 비교해줘. "
        "유사 서비스의 아키텍처 패턴을 바탕으로 우리 서비스의 개선점을 제안하고, "
        "필요한 클래스/메서드/관계(Edge)를 다이어그램에 추가해서 업데이트해줘."
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=history_to_contents(request.history, user_prompt),
            config=types.GenerateContentConfig(
                system_instruction=benchmark_analysis_system_instruction(
                    diagram_json,
                    request.projectContext
                ),
                response_mime_type="application/json",
                response_schema=BenchmarkAnalysisResponse,
                temperature=0.3,
            )
        )

        payload = json.loads(response.text)

        # autoApply가 False인 경우 원본 다이어그램 유지
        final_diagram = (
            payload.get("diagram") 
            if request.autoApply and payload.get("diagram") 
            else request.diagram.model_dump()
        )

        return BenchmarkAnalysisResponse(
            similarServices=payload.get("similarServices", []),
            improvements=payload.get("improvements", "").strip(),
            diagram=DiagramRes(**final_diagram)
        )

    except Exception as e:
        handle_genai_error(e, "유사 서비스 벤치마킹 분석 및 다이어그램 업그레이드")