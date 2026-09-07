import logging

from agents.states import MAX_DIAGRAM_RETRIES, DiagramAgentState
from agents.tool.apply import apply_tool

logger = logging.getLogger(__name__)


def act_diagram(state: DiagramAgentState) -> DiagramAgentState:
    """plan_steps 중 한 스텝만 툴로 적용한다. LLM은 호출하지 않는다."""

    plan_steps = state.get("plan_steps") or []
    idx = state.get("step_index") or 0
    diagram = state.get("generated_diagram")

    if idx >= len(plan_steps) or not diagram:
        return state

    step = plan_steps[idx]
    tool = step.get("tool") if isinstance(step, dict) else None
    args = step.get("args") if isinstance(step, dict) else None
    if not tool or not isinstance(args, dict):
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            state["retry_count"] += 1
        state["validation_error"] = (
            f"스텝 {idx + 1}이 툴 호출 형식이 아닙니다: {step}"
        )
        return state

    notes = []
    if state.get("generated_reply"):
        notes.append(state["generated_reply"])

    diagram, result = apply_tool(diagram, tool, args)
    if not result.get("ok"):
        logger.warning(f"스텝 {idx + 1} 실패 {tool}: {result}")
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            state["retry_count"] += 1
        state["validation_error"] = (
            f"스텝 {idx + 1} 실행 실패 ({tool}): "
            f"{result.get('error') or result}"
        )
        return state

    if result.get("message"):
        notes.append(result["message"])
    logger.info(f"스텝 {idx + 1} tool {tool}: {result}")

    state["generated_diagram"] = diagram
    state["step_index"] = idx + 1
    state["validation_error"] = None
    state["generated_reply"] = "\n".join(notes).strip() or None
    return state
