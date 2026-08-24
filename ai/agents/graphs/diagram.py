from langgraph.graph import END, StateGraph

from agents.nodes.generate_diagram import generate_diagram
from agents.nodes.validate_diagram import validate_diagram
from agents.states import MAX_DIAGRAM_RETRIES, DiagramAgentState


def route_validation(state: DiagramAgentState) -> str:
    if state.get("validation_error"):
        if state["retry_count"] <= MAX_DIAGRAM_RETRIES:
            return "generate"

    return "end"


diagram_workflow = StateGraph(DiagramAgentState)

diagram_workflow.add_node("generate", generate_diagram)
diagram_workflow.add_node("validate", validate_diagram)

diagram_workflow.set_entry_point("generate")
diagram_workflow.add_edge("generate", "validate")
diagram_workflow.add_conditional_edges(
    "validate",
    route_validation,
    {
        "generate": "generate",
        "end": END,
    },
)

diagram_agent_app = diagram_workflow.compile()
