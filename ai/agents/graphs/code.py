from langgraph.graph import END, StateGraph

from agents.nodes.generate_code import generate_code
from agents.nodes.validate_code import validate_code
from agents.states import MAX_CODE_RETRIES, CodeGenerationState


def route_code_validation(state: CodeGenerationState) -> str:
    if state.get("validation_error"):
        if state["retry_count"] <= MAX_CODE_RETRIES:
            return "generate"

    return "end"


code_workflow = StateGraph(CodeGenerationState)

code_workflow.add_node("generate", generate_code)
code_workflow.add_node("validate", validate_code)

code_workflow.set_entry_point("generate")
code_workflow.add_edge("generate", "validate")
code_workflow.add_conditional_edges(
    "validate",
    route_code_validation,
    {
        "generate": "generate",
        "end": END,
    },
)

code_agent_app = code_workflow.compile()
