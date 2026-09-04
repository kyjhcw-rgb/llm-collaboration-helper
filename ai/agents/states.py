from typing import List, Optional

from typing_extensions import TypedDict


class DiagramAgentState(TypedDict):
    mode: str
    system_instruction: str
    user_contents: list
    validation_error: Optional[str]
    retry_count: int

    generated_diagram: Optional[dict]
    original_diagram: Optional[dict]
    generated_reply: Optional[str]
    plan_steps: Optional[List[str]]
    step_index: int
    project_context: Optional[str]


class CodeGenerationState(TypedDict):
    mode: str
    system_instruction: str
    user_contents: list
    target_file_path: Optional[str]

    result: Optional[dict]
    validation_error: Optional[str]
    retry_count: int


MAX_DIAGRAM_RETRIES = 2
MAX_CODE_RETRIES = 1
MAX_TOOL_ROUNDS = 6
