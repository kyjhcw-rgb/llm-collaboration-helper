from agents.states import MAX_CODE_RETRIES, CodeGenerationState


def validate_code(state: CodeGenerationState) -> CodeGenerationState:
    """파일 트리/코드 결과의 최소 무결성을 검사한다."""

    result = state.get("result")

    if not result:
        if state["retry_count"] < MAX_CODE_RETRIES:
            state["retry_count"] += 1
            state["validation_error"] = (
                "생성 결과가 없습니다."
            )
        return state

    if state["mode"] == "file_tree":
        file_paths = result.get("filePaths")

        if not isinstance(file_paths, dict):
            state["validation_error"] = (
                "filePaths는 JSON object여야 합니다."
            )
        elif not file_paths:
            state["validation_error"] = (
                "생성된 파일 목록이 비어 있습니다."
            )
        else:
            state["validation_error"] = None

    else:
        file_path = result.get("filePath")
        code = result.get("code")

        if not file_path:
            state["validation_error"] = "filePath가 없습니다."
        elif code is None or not isinstance(code, str):
            state["validation_error"] = (
                "code가 문자열로 존재하지 않습니다."
            )
        elif not code.strip():
            state["validation_error"] = (
                "생성된 코드가 비어 있습니다."
            )
        elif (
            state.get("target_file_path")
            and file_path != state["target_file_path"]
        ):
            state["validation_error"] = (
                f"대상 파일 경로 불일치: "
                f"{file_path} != {state['target_file_path']}"
            )
        else:
            state["validation_error"] = None

    if (
        state["validation_error"]
        and state["retry_count"] < MAX_CODE_RETRIES
    ):
        state["retry_count"] += 1

    return state
