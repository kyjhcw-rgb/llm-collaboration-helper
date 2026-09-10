import json
from typing import Any, Dict, Optional
from fastapi import HTTPException

from schemas.common import DiagramRes
from agents.states import DiagramAgentState, CodeGenerationState


def serialize_diagram(diagram: DiagramRes) -> str:
    """DiagramRes 객체를 LLM 프롬프트 전달용 JSON 문자열로 직렬화"""
    return json.dumps(diagram.model_dump(), ensure_ascii=False)


def parse_diagram_json(raw_json: str) -> DiagramRes:
    """문자열 형태의 JSON을 DiagramRes Pydantic 객체로 안전하게 파싱"""
    try:
        diagram_dict = json.loads(raw_json)
        return DiagramRes(**diagram_dict)
    except Exception as parse_err:
        raise HTTPException(
            status_code=400,
            detail="전달받은 currentDiagram JSON 형식이 올바르지 않습니다."
        ) from parse_err


def build_diagram_agent_state(
    mode: str,
    system_instruction: str,
    user_contents: list,
    diagram: Optional[DiagramRes] = None,
    project_context: Optional[str] = None
) -> DiagramAgentState:
    """Diagram Agent 실행을 위한 초기 State 객체 생성"""
    snapshot = diagram.model_dump() if diagram else None
    return {
        "mode": mode,
        "system_instruction": system_instruction,
        "user_contents": user_contents,
        "validation_error": None,
        "retry_count": 0,
        "generated_diagram": snapshot,
        "original_diagram": snapshot,
        "generated_reply": None,
        "plan_steps": None,
        "step_index": 0,
        "project_context": project_context,
    }


def build_code_agent_state(
    mode: str,
    system_instruction: str,
    user_contents: list,
    target_file_path: Optional[str] = None
) -> CodeGenerationState:
    """Code Agent 실행을 위한 초기 State 객체 생성"""
    return {
        "mode": mode,
        "system_instruction": system_instruction,
        "user_contents": user_contents,
        "target_file_path": target_file_path,
        "result": None,
        "validation_error": None,
        "retry_count": 0
    }