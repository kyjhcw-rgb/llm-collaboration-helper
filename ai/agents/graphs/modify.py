from langgraph.graph import END, StateGraph

from agents.nodes.act import act_diagram
from agents.nodes.plan import plan_diagram
from agents.nodes.validate_diagram import validate_diagram
from agents.states import MAX_DIAGRAM_RETRIES, DiagramAgentState


def route_after_plan(state: DiagramAgentState) -> str:
    if state.get("validation_error"):
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            return "plan"
        return "end"
    if state.get("plan_steps"):
        return "act"
    return "validate"


def route_after_act(state: DiagramAgentState) -> str:
    if state.get("validation_error"):
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            return "plan"
        return "end"
    plan_steps = state.get("plan_steps") or []
    if (state.get("step_index") or 0) < len(plan_steps):
        return "act"
    return "validate"


def route_after_validate(state: DiagramAgentState) -> str:
    if state.get("validation_error"):
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            return "plan"
    return "end"


modify_workflow = StateGraph(DiagramAgentState)

modify_workflow.add_node("plan", plan_diagram)
modify_workflow.add_node("act", act_diagram)
modify_workflow.add_node("validate", validate_diagram)

modify_workflow.set_entry_point("plan")
modify_workflow.add_conditional_edges(
    "plan",
    route_after_plan,
    {"plan": "plan", "act": "act", "validate": "validate", "end": END},
)
modify_workflow.add_conditional_edges(
    "act",
    route_after_act,
    {"plan": "plan", "act": "act", "validate": "validate", "end": END},
)
modify_workflow.add_conditional_edges(
    "validate",
    route_after_validate,
    {"plan": "plan", "end": END},
)

modify_agent_app = modify_workflow.compile()
