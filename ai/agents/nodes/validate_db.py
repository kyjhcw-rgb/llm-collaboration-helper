import logging

from agents.states import MAX_CODE_RETRIES, CodeGenerationState

logger = logging.getLogger(__name__)


def validate_db(state: CodeGenerationState) -> CodeGenerationState:
    """생성된 DB DDL SQL 결과의 최소 무결성을 검사한다."""

    result = state.get("result")

    if not result:
        if state["retry_count"] < MAX_CODE_RETRIES:
            state["retry_count"] += 1
            state["validation_error"] = "생성 결과가 없습니다."
        return state

    sql = result.get("sql")

    if sql is None or not isinstance(sql, str):
        state["validation_error"] = "sql 필드가 문자열 형태로 존재하지 않습니다."
    elif not sql.strip():
        state["validation_error"] = "생성된 DDL SQL이 비어 있습니다."
    elif "CREATE" not in sql.upper():
        state["validation_error"] = (
            "올바른 DDL SQL 구문이 아닙니다 (CREATE 문이 포함되어 있지 않습니다)."
        )
    else:
        state["validation_error"] = None

    # 검증 에러 발생 시 재시도 카운트 증가
    if state["validation_error"] and state["retry_count"] < MAX_CODE_RETRIES:
        state["retry_count"] += 1
        logger.warning(
            f"DB DDL 검증 실패 (재시도 {state['retry_count']}/{MAX_CODE_RETRIES}): "
            f"{state['validation_error']}"
        )

    return state