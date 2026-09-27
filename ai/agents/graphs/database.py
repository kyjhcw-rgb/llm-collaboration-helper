from langgraph.graph import END, StateGraph

from agents.nodes.generate_db import generate_db
from agents.nodes.validate_db import validate_db
from agents.states import MAX_DB_RETRIES, CodeGenerationState


def route_db_validation(state: CodeGenerationState) -> str:
    """검증 실패 시 MAX_DB_RETRIES번까지 재생성. retry_count는 실패마다 validate에서 증가한다."""
    if state.get("validation_error") and state["retry_count"] <= MAX_DB_RETRIES:
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
