from langgraph.graph import END, StateGraph

from agents.nodes.generate_db import generate_db
from agents.nodes.validate_db import validate_db
from agents.states import MAX_CODE_RETRIES, CodeGenerationState


def route_db_validation(state: CodeGenerationState) -> str:
    """DB DDL 검증 에러 발생 시 재시도 조건 제어"""
    if state.get("validation_error"):
        if state["retry_count"] <= MAX_CODE_RETRIES:
            return "generate"

    return "end"


# StateGraph 구성
db_workflow = StateGraph(CodeGenerationState)

db_workflow.add_node("generate", generate_db)
db_workflow.add_node("validate", validate_db)

db_workflow.set_entry_point("generate")
db_workflow.add_edge("generate", "validate")
db_workflow.add_conditional_edges(
    "validate",
    route_db_validation,
    {
        "generate": "generate",
        "end": END,
    },
)

# 최종 서비스 호출용 Compiled Graph App
database_agent_app = db_workflow.compile()