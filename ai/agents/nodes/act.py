import json
import logging

from google.genai import types

from agents.prompts import act_system_instruction
from agents.states import MAX_DIAGRAM_RETRIES, MAX_TOOL_ROUNDS, DiagramAgentState
from agents.tool.apply import apply_tool
from agents.tool.tools import DIAGRAM_TOOLS
from core.config import MODEL_ID, client

logger = logging.getLogger(__name__)


def _call_args(function_call) -> dict:
    raw = function_call.args
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    return dict(raw)


def act_diagram(state: DiagramAgentState) -> DiagramAgentState:
    """현재 plan 스텝 하나만 툴로 실행한다."""

    plan = state.get("plan") or []
    idx = state.get("step_index") or 0
    diagram = state.get("generated_diagram")

    if idx >= len(plan) or not diagram:
        return state

    step = plan[idx]
    contents = list(state["user_contents"])
    contents.append({
        "role": "user",
        "parts": [{
            "text": (
                f"[현재 스텝 {idx + 1}/{len(plan)}]\n{step}\n"
                "이 스텝만 처리하고, 끝나면 툴 없이 한 줄로 확인하라."
            )
        }],
    })

    notes = []
    if state.get("generated_reply"):
        notes.append(state["generated_reply"])

    try:
        for _ in range(MAX_TOOL_ROUNDS):
            diagram_json = json.dumps(diagram, ensure_ascii=False)
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=act_system_instruction(
                        diagram_json,
                        state.get("project_context"),
                    ),
                    tools=DIAGRAM_TOOLS,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True
                    ),
                    temperature=0.1,
                ),
            )

            calls = list(response.function_calls or [])
            if not calls:
                text = (response.text or "").strip()
                if text:
                    notes.append(text)
                break

            contents.append(response.candidates[0].content)
            replies = []
            for call in calls:
                diagram, result = apply_tool(
                    diagram,
                    call.name,
                    _call_args(call),
                )
                if result.get("message"):
                    notes.append(result["message"])
                logger.info(f"tool {call.name}: {result}")
                replies.append(
                    types.Part.from_function_response(
                        name=call.name,
                        response=result,
                    )
                )
            contents.append(types.Content(role="user", parts=replies))
        else:
            logger.warning(f"스텝 {idx + 1} tool 한도 초과")

    except Exception as e:
        logger.error(f"act 노드 에러: {str(e)}", exc_info=True)
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            state["retry_count"] += 1
        state["validation_error"] = (
            f"스텝 실행에 실패했습니다: {step}"
        )
        return state

    state["generated_diagram"] = diagram
    state["step_index"] = idx + 1
    state["validation_error"] = None

    if state["step_index"] >= len(plan) and not notes:
        notes.append("다음 변경을 반영했습니다. " + "; ".join(plan))

    state["generated_reply"] = "\n".join(notes).strip() or None
    return state
