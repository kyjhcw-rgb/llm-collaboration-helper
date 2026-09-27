import logging

from fastapi import HTTPException

from agents.graphs.database import database_agent_app
from agents.prompts import database_ddl_system_instruction, database_ddl_user_message
from agents.states import CodeGenerationState
from core.exceptions import handle_genai_error
from schemas.database import DatabaseDDLResponse, DatabaseGenerateRequest
from utils.diagram_helper import serialize_diagram

logger = logging.getLogger(__name__)

SUPPORTED_DB_TYPES = ("mysql", "postgresql")


def generate_database_ddl(request: DatabaseGenerateRequest) -> DatabaseDDLResponse:
    """다이어그램 구조를 분석해 DDL을 생성하고, 검증을 통과할 때까지 재생성한다."""
    db_type = request.dbType.lower()
    if db_type not in SUPPORTED_DB_TYPES:
        raise HTTPException(
            status_code=400,
            detail="지원하지 않는 데이터베이스 종류입니다. 'mysql' 또는 'postgresql'을 선택하세요."
        )

    initial_state: CodeGenerationState = {
        "mode": "database",
        "system_instruction": database_ddl_system_instruction(db_type, serialize_diagram(request.diagram)),
        "user_contents": [database_ddl_user_message(db_type)],
        "target_file_path": None,
        "db_type": db_type,
        "result": None,
        "validation_error": None,
        "retry_count": 0,
    }

    try:
        final_state = database_agent_app.invoke(initial_state)
    except Exception as e:
        handle_genai_error(e, f"[{db_type}] 데이터베이스 DDL 생성")

    payload = final_state.get("result")
    validation_error = final_state.get("validation_error")

    if validation_error or not payload:
        logger.error(f"[{db_type}] DDL 검증 최종 실패:\n{validation_error}")
        raise HTTPException(
            status_code=502,
            detail=f"검증을 통과한 DDL을 생성하지 못했습니다.\n{validation_error or ''}".strip()
        )

    return DatabaseDDLResponse(
        dbType=db_type,
        sql=payload.get("sql", "").strip(),
        summary=(payload.get("summary") or "").strip()
    )
