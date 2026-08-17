import os
import json
import logging
import requests
from typing import Dict, List, Optional, Any
from typing_extensions import TypedDict

from fastapi import FastAPI, HTTPException, Form, File, UploadFile
from pydantic import BaseModel, Field
from google import genai
from google.genai import types, errors
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END


# =====================================================================
# Logging
# =====================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)


# =====================================================================
# Environment / App
# =====================================================================
load_dotenv()

app = FastAPI(title="Our Diagram AI Agent (LangGraph Edition)")

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_ID = "gemini-2.5-flash"


# =====================================================================
# Clova Speech API
# =====================================================================
CLOVA_INVOKE_URL = os.getenv(
    "CLOVA_INVOKE_URL",
    "https://clovaspeech-gw.ncloud.com/external/v1/15024/c4de3225b3ec50c9169584d70190755dfdfb078ecb26515de6fd0a2f12288d75"
)
CLOVA_SECRET_KEY = os.getenv("CLOVA_SECRET_KEY")


# =====================================================================
# In-memory storage
# Production에서는 DB/Redis 등으로 교체 권장
# =====================================================================
db_chat_history: Dict[str, List[dict]] = {}
db_diagram_snapshots: Dict[str, List[dict]] = {}


# =====================================================================
# Pydantic Schemas
# =====================================================================
class MethodNode(BaseModel):
    id: str = Field(description="고유 ID (예: method_login)")
    name: str = Field(description="메서드 이름 (예: login)")
    description: str = Field(default="", description="메서드 역할 설명")
    parameters: Optional[str] = Field(
        default=None,
        description="파라미터 (예: String email, String pwd)"
    )
    returnType: Optional[str] = Field(
        default=None,
        description="리턴 타입 (예: ResponseEntity)"
    )


class ClassNode(BaseModel):
    id: str = Field(description="고유 ID (예: cls_auth_controller)")
    name: str = Field(description="클래스·인터페이스 이름")
    description: str = Field(default="", description="클래스 역할 설명")
    annotations: Optional[str] = Field(
        default=None,
        description="어노테이션 (예: @RestController)"
    )
    methods: List[MethodNode] = Field(default_factory=list)


class FeatureNode(BaseModel):
    id: str = Field(description="고유 ID (예: feat_auth)")
    name: str = Field(description="도메인·기능 단위 이름")
    description: str = Field(default="", description="기능 설명")
    classes: List[ClassNode] = Field(default_factory=list)


class RelationEdge(BaseModel):
    id: str = Field(description="엣지 고유 ID (예: edge_1)")
    fromId: str = Field(description="출발 노드 id (class 또는 method)")
    to: str = Field(description="도착 노드 id")
    kind: str = Field(description="CALL, INHERIT, IMPLEMENT 중 하나")


class DiagramRes(BaseModel):
    features: List[FeatureNode]
    edges: List[RelationEdge] = Field(default_factory=list)


class DiagramGenerationRequest(BaseModel):
    title: str
    framework: str
    freedomLevel: int
    descriptionPrompt: str


class ChatHistoryTurn(BaseModel):
    sender: str
    message: str


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=4000)
    diagram: DiagramRes
    history: List[ChatHistoryTurn] = Field(default_factory=list)
    projectContext: Optional[str] = Field(
        default=None,
        description="프로젝트 초기 기획 설명"
    )


class ChatResponse(BaseModel):
    reply: str


class ModifyResponse(BaseModel):
    reply: str = Field(description="변경 요약 설명 (한국어)")
    diagram: DiagramRes = Field(description="수정이 반영된 전체 다이어그램")


class FileTreeRequest(BaseModel):
    diagram: DiagramRes = Field(description="코드로 변환할 최신 다이어그램 구조")
    targetFramework: str = Field(description="변환할 타겟 프레임워크")


class FileStructureResponse(BaseModel):
    filePaths: Dict[str, str] = Field(
        description="Key: 파일 경로, Value: 파일의 역할 요약"
    )


class SingleCodeGenerationRequest(BaseModel):
    diagram: DiagramRes = Field(description="최신 다이어그램 구조")
    targetFramework: str = Field(description="타겟 프레임워크")
    targetFilePath: str = Field(description="코드를 생성할 대상 파일 경로")


class SingleCodeGenerationResponse(BaseModel):
    filePath: str
    code: str = Field(description="해당 파일의 완벽한 소스 코드 내용")


# =====================================================================
# Utility: Diagram ID / Edge Validation
# =====================================================================
def get_valid_node_ids(diagram: dict) -> set:
    valid_ids = set()

    for feature in diagram.get("features", []):
        if feature.get("id"):
            valid_ids.add(feature["id"])

        for cls in feature.get("classes", []):
            if cls.get("id"):
                valid_ids.add(cls["id"])

            for method in cls.get("methods", []):
                if method.get("id"):
                    valid_ids.add(method["id"])

    return valid_ids


def get_invalid_edges(diagram: dict) -> List[str]:
    valid_ids = get_valid_node_ids(diagram)
    invalid_edge_ids = []

    for edge in diagram.get("edges", []):
        from_id = edge.get("fromId")
        to_id = edge.get("to")

        if from_id not in valid_ids or to_id not in valid_ids:
            invalid_edge_ids.append(edge.get("id"))

    return invalid_edge_ids


def get_structural_validation_errors(diagram: dict) -> List[str]:
    """
    LangGraph 검증 단계에서 사용할 구조 검증.
    기존 main.py의 핵심 동작을 유지하면서
    중복 ID / 잘못된 edge kind까지 추가로 확인한다.
    """
    errors_found = []
    ids = []

    for feature in diagram.get("features", []):
        feature_id = feature.get("id")
        if not feature_id:
            errors_found.append("feature에 id가 없습니다.")
        else:
            ids.append(feature_id)

        for cls in feature.get("classes", []):
            class_id = cls.get("id")
            if not class_id:
                errors_found.append(
                    f"feature [{feature_id}] 내부 class에 id가 없습니다."
                )
            else:
                ids.append(class_id)

            for method in cls.get("methods", []):
                method_id = method.get("id")
                if not method_id:
                    errors_found.append(
                        f"class [{class_id}] 내부 method에 id가 없습니다."
                    )
                else:
                    ids.append(method_id)

    duplicates = sorted({x for x in ids if ids.count(x) > 1})
    if duplicates:
        errors_found.append(
            f"중복된 node ID가 존재합니다: {', '.join(duplicates)}"
        )

    allowed_kinds = {"CALL", "INHERIT", "IMPLEMENT"}

    for edge in diagram.get("edges", []):
        if edge.get("kind") not in allowed_kinds:
            errors_found.append(
                f"edge [{edge.get('id')}]의 kind가 올바르지 않습니다. "
                f"허용값: CALL, INHERIT, IMPLEMENT"
            )

    errors_found.extend(
        [
            f"존재하지 않는 node를 참조하는 edge: {edge_id}"
            for edge_id in get_invalid_edges(diagram)
        ]
    )

    return errors_found


def validate_and_filter_edges(diagram: dict) -> dict:
    """
    기존 main.py와 동일하게 존재하지 않는 node를 참조하는 edge를 제거한다.
    """
    valid_ids = get_valid_node_ids(diagram)
    clean_edges = []

    for edge in diagram.get("edges", []):
        from_id = edge.get("fromId")
        to_id = edge.get("to")

        if from_id in valid_ids and to_id in valid_ids:
            clean_edges.append(edge)
        else:
            logger.warning(
                f"유령 엣지가 감지되어 제거되었습니다: {edge.get('id')}"
            )

    diagram["edges"] = clean_edges
    return diagram


def validate_final_diagram(diagram: dict) -> dict:
    """
    최종 반환 전 Pydantic 구조 검증 + edge filtering.
    """
    cleaned = validate_and_filter_edges(diagram)
    DiagramRes(**cleaned)
    return cleaned


def _freedom_level_hint(level: int) -> str:
    if level <= 1:
        return "feature와 class 위주로 설계하고, method는 핵심만 최소한으로 포함해."
    if level == 2:
        return "주요 class와 핵심 method를 포함하고, edges로 주요 의존 관계를 표현해."
    return "class와 method를 세분화하고, edges도 풍부하게 포함해."


# =====================================================================
# Clova STT
# =====================================================================
def request_clova_stt(
    file_bytes: bytes,
    filename: str,
    content_type: str = "audio/webm"
) -> str:
    """Clova Speech API를 호출하여 화자 분리 STT 텍스트를 반환한다."""

    if not CLOVA_SECRET_KEY:
        logger.error("CLOVA_SECRET_KEY 환경 변수가 설정되지 않았습니다.")
        raise HTTPException(
            status_code=500,
            detail="Clova STT API 키 설정이 누락되었습니다."
        )

    request_url = f"{CLOVA_INVOKE_URL.rstrip('/')}/recognizer/upload"

    params = {
        "language": "ko-KR",
        "completion": "sync",
        "diarization": {"enable": True}
    }

    headers = {
        "X-CLOVASPEECH-API-KEY": CLOVA_SECRET_KEY
    }

    files = {
        "media": (
            filename or "meeting_audio.webm",
            file_bytes,
            content_type or "audio/webm"
        ),
        "params": (
            None,
            json.dumps(params),
            "application/json"
        )
    }

    try:
        response = requests.post(
            request_url,
            headers=headers,
            files=files
        )

        if response.status_code != 200:
            logger.error(
                f"Clova STT API Error: "
                f"{response.status_code} - {response.text}"
            )
            raise HTTPException(
                status_code=502,
                detail=f"Clova STT 변환 실패 (상태 코드: {response.status_code})"
            )

        res = response.json()
        segments = res.get("segments", [])

        if segments:
            formatted_text = [
                f"[{seg.get('speaker', {}).get('name', '참여자')}]: "
                f"{seg.get('text', '')}"
                for seg in segments
            ]
            return "\n".join(formatted_text)

        return res.get("text", "")

    except HTTPException:
        raise
    except requests.RequestException as e:
        logger.error(f"Clova STT 통신 실패: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail="Clova STT 서버와의 통신 중 오류가 발생했습니다."
        )


# =====================================================================
# Gemini Error Handler
# =====================================================================
def handle_genai_error(e: Exception, context_msg: str):
    logger.error(
        f"{context_msg} 에러: {str(e)}",
        exc_info=True
    )

    if isinstance(e, HTTPException):
        raise e

    if isinstance(e, errors.APIError):
        status_code = getattr(e, "code", 500)

        if status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요."
            )

        if status_code in (401, 403):
            raise HTTPException(
                status_code=401,
                detail="API 인증 오류입니다. API 키를 확인해주세요."
            )

        if status_code == 400:
            raise HTTPException(
                status_code=400,
                detail="잘못된 요청입니다. (JSON 스키마 파싱 오류 또는 모델 제약 위반)"
            )

        raise HTTPException(
            status_code=502,
            detail=f"Gemini API 통신 오류: {getattr(e, 'message', str(e))}"
        )

    raise HTTPException(
        status_code=500,
        detail=f"{context_msg} 중 서버 내부 오류가 발생했습니다."
    )


# =====================================================================
# LangGraph 1
# Diagram Generate / Modify Agent
# =====================================================================
class DiagramAgentState(TypedDict):
    mode: str
    system_instruction: str
    user_contents: list
    validation_error: Optional[str]
    retry_count: int

    generated_diagram: Optional[dict]
    generated_reply: Optional[str]


MAX_DIAGRAM_RETRIES = 2


def node_generate_diagram(state: DiagramAgentState) -> DiagramAgentState:
    """
    Gemini를 호출하여 초기 다이어그램을 생성하거나
    기존 다이어그램을 수정한다.
    """

    instruction = state["system_instruction"]

    if state["validation_error"]:
        instruction += (
            "\n\n"
            "[이전 시도에서 발견된 오류]\n"
            f"{state['validation_error']}\n"
            "위 오류를 반드시 수정하여 전체 결과를 다시 생성하세요."
        )

        logger.info(
            f"다이어그램 자가 수정 루프 진입 "
            f"(재시도: {state['retry_count']})"
        )

    response_schema = (
        DiagramRes
        if state["mode"] == "initial"
        else ModifyResponse
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=state["user_contents"],
            config=types.GenerateContentConfig(
                system_instruction=instruction,
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.2,
            ),
        )

        payload = json.loads(response.text)

        if state["mode"] == "initial":
            state["generated_diagram"] = payload
            state["generated_reply"] = None
        else:
            state["generated_diagram"] = payload.get("diagram")
            state["generated_reply"] = (
                payload.get("reply") or ""
            ).strip()

            if not state["generated_diagram"]:
                state["validation_error"] = (
                    "수정 결과에 diagram이 없습니다."
                )
            elif not state["generated_reply"]:
                state["validation_error"] = (
                    "수정 결과에 reply가 없습니다."
                )

    except Exception as e:
        logger.error(
            f"다이어그램 생성 노드 에러: {str(e)}",
            exc_info=True
        )
        state["generated_diagram"] = None
        state["generated_reply"] = None
        state["validation_error"] = (
            "JSON 생성 또는 파싱에 실패했습니다. "
            "지정된 스키마에 맞춰 다시 생성하세요."
        )

    return state


def node_validate_diagram(state: DiagramAgentState) -> DiagramAgentState:
    """
    생성된 다이어그램의 구조와 edge 무결성을 검사한다.
    """

    generated = state.get("generated_diagram")

    if not generated:
        if not state.get("validation_error"):
            state["validation_error"] = (
                "생성된 다이어그램이 없습니다."
            )
        return state

    try:
        structural_errors = get_structural_validation_errors(
            generated
        )
    except Exception as e:
        structural_errors = [
            f"다이어그램 검증 중 오류가 발생했습니다: {str(e)}"
        ]

    if structural_errors and state["retry_count"] < MAX_DIAGRAM_RETRIES:
        state["validation_error"] = "\n".join(
            structural_errors
        )
        state["retry_count"] += 1

        logger.warning(
            "다이어그램 검증 실패. 재생성합니다. "
            f"retry={state['retry_count']}, "
            f"errors={structural_errors}"
        )

        return state

    if structural_errors:
        # 최대 재시도 후에는 기존 main.py와 동일하게
        # 유령 edge는 제거하고 최종 결과를 반환한다.
        logger.warning(
            "최대 재시도 횟수를 초과했습니다. "
            "유효하지 않은 edge를 최종 제거합니다."
        )

    try:
        state["generated_diagram"] = validate_final_diagram(
            generated
        )
        state["validation_error"] = None
    except Exception as e:
        if state["retry_count"] < MAX_DIAGRAM_RETRIES:
            state["validation_error"] = (
                f"최종 Pydantic 검증 실패: {str(e)}"
            )
            state["retry_count"] += 1
        else:
            state["validation_error"] = None
            state["generated_diagram"] = validate_and_filter_edges(
                generated
            )

    return state


def route_validation(state: DiagramAgentState) -> str:
    if state.get("validation_error"):
        if state["retry_count"] <= MAX_DIAGRAM_RETRIES:
            return "generate"

    return "end"


diagram_workflow = StateGraph(DiagramAgentState)

diagram_workflow.add_node(
    "generate",
    node_generate_diagram
)
diagram_workflow.add_node(
    "validate",
    node_validate_diagram
)

diagram_workflow.set_entry_point("generate")

diagram_workflow.add_edge(
    "generate",
    "validate"
)

diagram_workflow.add_conditional_edges(
    "validate",
    route_validation,
    {
        "generate": "generate",
        "end": END
    }
)

diagram_agent_app = diagram_workflow.compile()


# =====================================================================
# LangGraph 2
# File Tree / Single Code Generation
# =====================================================================
class CodeGenerationState(TypedDict):
    mode: str
    system_instruction: str
    user_contents: list
    target_file_path: Optional[str]

    result: Optional[dict]
    validation_error: Optional[str]
    retry_count: int


MAX_CODE_RETRIES = 1


def node_generate_code_artifact(
    state: CodeGenerationState
) -> CodeGenerationState:
    """파일 트리 또는 단일 소스 코드를 생성한다."""

    instruction = state["system_instruction"]

    if state["validation_error"]:
        instruction += (
            "\n\n"
            "[이전 생성 오류]\n"
            f"{state['validation_error']}\n"
            "오류를 수정하여 다시 생성하세요."
        )

    if state["mode"] == "file_tree":
        response_schema = FileStructureResponse
    else:
        response_schema = SingleCodeGenerationResponse

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=state["user_contents"],
            config=types.GenerateContentConfig(
                system_instruction=instruction,
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=(
                    0.1 if state["mode"] == "file_tree"
                    else 0.3
                ),
            ),
        )

        payload = json.loads(response.text)

        if state["mode"] == "file_tree":
            if not isinstance(
                payload.get("filePaths"),
                dict
            ):
                raise ValueError(
                    "filePaths가 dictionary가 아닙니다."
                )
        else:
            if not payload.get("filePath"):
                raise ValueError(
                    "filePath가 없습니다."
                )

            if "code" not in payload:
                raise ValueError(
                    "code가 없습니다."
                )

            expected_path = state.get("target_file_path")
            actual_path = payload.get("filePath")

            if expected_path and actual_path != expected_path:
                raise ValueError(
                    f"요청한 파일 [{expected_path}]과 "
                    f"응답 파일 [{actual_path}]이 다릅니다."
                )

        state["result"] = payload
        state["validation_error"] = None

    except Exception as e:
        logger.error(
            f"코드 생성 노드 에러: {str(e)}",
            exc_info=True
        )

        state["result"] = None
        state["validation_error"] = str(e)

    return state


def node_validate_code_artifact(
    state: CodeGenerationState
) -> CodeGenerationState:
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


def route_code_validation(state: CodeGenerationState) -> str:
    if state.get("validation_error"):
        if state["retry_count"] <= MAX_CODE_RETRIES:
            return "generate"

    return "end"


code_workflow = StateGraph(CodeGenerationState)

code_workflow.add_node(
    "generate",
    node_generate_code_artifact
)

code_workflow.add_node(
    "validate",
    node_validate_code_artifact
)

code_workflow.set_entry_point("generate")

code_workflow.add_edge(
    "generate",
    "validate"
)

code_workflow.add_conditional_edges(
    "validate",
    route_code_validation,
    {
        "generate": "generate",
        "end": END
    }
)

code_agent_app = code_workflow.compile()


# =====================================================================
# [기능 1] 프로젝트 다이어그램 기반 챗봇
# 원래 main.py의 stateless 동작 유지
# =====================================================================
@app.post(
    "/project/ask",
    response_model=ChatResponse
)
async def chat_about_project(request: ChatRequest):

    diagram_json = json.dumps(
        request.diagram.model_dump(),
        ensure_ascii=False
    )

    context_block = ""

    if request.projectContext:
        context_block = (
            f"\n[프로젝트 초기 기획]\n"
            f"{request.projectContext}\n"
        )

    system_instruction = (
        "당신은 소프트웨어 아키텍처를 설명하는 AI 어시스턴트입니다.\n"
        "아래 [프로젝트 다이어그램] JSON만 근거로 답하세요.\n"
        "다이어그램에 없는 내용은 추측하지 말고, "
        "모르면 '다이어그램에 해당 정보가 없습니다'라고 답하세요.\n"
        f"{context_block}"
        f"[프로젝트 다이어그램]\n{diagram_json}"
    )

    contents = []

    for turn in request.history:
        role = (
            "user"
            if turn.sender.upper() == "USER"
            else "model"
        )

        contents.append({
            "role": role,
            "parts": [{"text": turn.message}]
        })

    contents.append({
        "role": "user",
        "parts": [{"text": request.message}]
    })

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction
            )
        )

        return ChatResponse(
            reply=response.text
        )

    except Exception as e:
        handle_genai_error(
            e,
            "프로젝트 챗봇 응답 생성"
        )


# =====================================================================
# [기능 2] 초기 다이어그램 생성
# LangGraph: Generate → Validate → Retry
# =====================================================================
@app.post(
    "/projects/initial-diagram",
    response_model=DiagramRes
)
async def generate_initial_diagram(
    request: DiagramGenerationRequest,
    session_id: Optional[str] = None
):

    system_instruction = (
        "너는 소프트웨어 아키텍처를 설계하는 시니어 개발자야.\n"
        "사용자 기획에 맞춰 초기 다이어그램을 JSON으로 설계해.\n"
        "구조 규칙:\n"
        "1. features: 도메인·기능 단위 (id, name, description)\n"
        "2. 각 feature 안에 classes 배열\n"
        "3. 각 class 안에 methods 배열\n"
        "4. edges: 노드 간 관계. fromId, to는 반드시 위에서 만든 id와 일치\n"
        "5. edges.kind: CALL, INHERIT, IMPLEMENT\n"
        "6. 절대 부연 설명 없이 지정된 JSON 스키마로만 응답해."
    )

    user_message = (
        f"프로젝트 제목: {request.title}\n"
        f"사용 프레임워크: {request.framework}\n"
        f"자유도 레벨: {request.freedomLevel} — "
        f"{_freedom_level_hint(request.freedomLevel)}\n"
        f"기획 내용: {request.descriptionPrompt}"
    )

    initial_state: DiagramAgentState = {
        "mode": "initial",
        "system_instruction": system_instruction,
        "user_contents": [user_message],
        "validation_error": None,
        "retry_count": 0,
        "generated_diagram": None,
        "generated_reply": None
    }

    try:
        result = diagram_agent_app.invoke(
            initial_state
        )

        if not result.get("generated_diagram"):
            raise HTTPException(
                status_code=502,
                detail="AI가 다이어그램을 생성하지 못했습니다."
            )

        diagram = validate_final_diagram(
            result["generated_diagram"]
        )

        # Undo snapshot
        if session_id:
            if session_id not in db_diagram_snapshots:
                db_diagram_snapshots[session_id] = []

            db_diagram_snapshots[session_id].append({
                "diagram": json.loads(
                    json.dumps(diagram)
                ),
                "chat_history": []
            })

        return DiagramRes(**diagram)

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            "다이어그램 초기 생성"
        )


# =====================================================================
# [기능 3] 다이어그램 수정
# LangGraph: Generate → Validate → Retry
# =====================================================================
@app.post(
    "/project/agent",
    response_model=ModifyResponse
)
async def modify_diagram(
    request: ChatRequest,
    session_id: Optional[str] = None
):

    diagram_json = json.dumps(
        request.diagram.model_dump(),
        ensure_ascii=False
    )

    context_block = ""

    if request.projectContext:
        context_block = (
            f"\n[프로젝트 초기 기획]\n"
            f"{request.projectContext}\n"
        )

    system_instruction = (
        "당신은 소프트웨어 아키텍처 다이어그램을 수정하는 AI 에이전트입니다.\n"
        "사용자의 수정 요청을 반영한 전체 다이어그램과, "
        "무엇을 바꿨는지 설명하는 reply를 함께 반환하세요.\n"
        "\n"
        "[수정 규칙]\n"
        "1. ID 유지: 명시적 삭제/변경이 없는 기존 feature, "
        "class, method ID는 절대 유지\n"
        "2. 노드 추가: 기존 ID와 겹치지 않는 고유 ID 부여 "
        "(예: feat_xxx, cls_xxx, method_xxx)\n"
        "3. edges 동기화: 노드 추가/삭제에 맞춰 edges를 갱신. "
        "fromId/to는 실제 존재하는 id만\n"
        "4. edges.kind: CALL, INHERIT, IMPLEMENT 중 하나\n"
        "5. 요청과 무관한 부분은 임의로 바꾸지 말 것\n"
        "6. 다이어그램에 없는 가정을 크게 늘리지 말 것 "
        "(필요하면 reply에 가정을 짧게 명시)\n"
        "\n"
        "[응답]\n"
        "- reply: 한국어로 변경 요약 "
        "(무엇을 추가/수정/삭제했는지 2~5문장)\n"
        "- diagram: 수정이 반영된 전체 다이어그램 JSON "
        "(부분 패치가 아님)\n"
        f"{context_block}"
        f"[현재 프로젝트 다이어그램]\n{diagram_json}"
    )

    contents = []

    for turn in request.history:
        role = (
            "user"
            if turn.sender.upper() == "USER"
            else "model"
        )

        contents.append({
            "role": role,
            "parts": [{"text": turn.message}]
        })

    contents.append({
        "role": "user",
        "parts": [{"text": request.message}]
    })

    initial_state: DiagramAgentState = {
        "mode": "modify",
        "system_instruction": system_instruction,
        "user_contents": contents,
        "validation_error": None,
        "retry_count": 0,
        "generated_diagram": None,
        "generated_reply": None
    }

    try:
        result = diagram_agent_app.invoke(
            initial_state
        )

        if not result.get("generated_diagram"):
            raise HTTPException(
                status_code=502,
                detail="AI가 수정된 다이어그램을 반환하지 않았습니다."
            )

        if not result.get("generated_reply"):
            raise HTTPException(
                status_code=502,
                detail="AI가 변경 설명(reply)을 반환하지 않았습니다."
            )

        diagram = validate_final_diagram(
            result["generated_diagram"]
        )

        reply = result["generated_reply"].strip()

        # Undo snapshot
        if session_id:
            if session_id not in db_diagram_snapshots:
                db_diagram_snapshots[session_id] = [
                    {
                        "diagram": json.loads(
                            json.dumps(
                                request.diagram.model_dump()
                            )
                        ),
                        "chat_history": request.history
                    }
                ]

            db_diagram_snapshots[session_id].append({
                "diagram": json.loads(
                    json.dumps(diagram)
                ),
                "chat_history": request.history
            })

        return ModifyResponse(
            reply=reply,
            diagram=DiagramRes(**diagram)
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            "다이어그램 수정"
        )


# =====================================================================
# [기능 3-1]
# 회의 음성 → Clova STT → LangGraph 다이어그램 수정
# =====================================================================
@app.post(
    "/projects/process-meeting-audio",
    response_model=ModifyResponse
)
async def process_meeting_audio(
    sessionId: Optional[str] = Form(None),
    currentDiagram: str = Form(...),
    projectContext: Optional[str] = Form(None),
    file: UploadFile = File(...)
):

    try:
        # 1. Audio binary
        audio_bytes = await file.read()

        if not audio_bytes:
            raise HTTPException(
                status_code=400,
                detail="업로드된 음성 파일이 비어있습니다."
            )

        # 2. Clova STT
        meeting_text = request_clova_stt(
            file_bytes=audio_bytes,
            filename=file.filename,
            content_type=file.content_type
        )

        if not meeting_text.strip():
            raise HTTPException(
                status_code=400,
                detail="음성에서 인식된 회의 내용 텍스트가 없습니다."
            )

        logger.info(
            f"Session [{sessionId}] - STT 변환 완료:\n"
            f"{meeting_text}"
        )

        # 3. currentDiagram parsing
        try:
            diagram_dict = json.loads(currentDiagram)
            diagram_obj = DiagramRes(**diagram_dict)
        except Exception as parse_err:
            logger.error(
                f"다이어그램 JSON 파싱 에러: {parse_err}"
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    "전달받은 currentDiagram JSON 형식이 "
                    "올바르지 않습니다."
                )
            )

        # 4. Meeting transcript → modify request
        instruction_message = (
            "다음은 진행된 개발 회의 녹음의 STT 변환 텍스트입니다. "
            "회의 내용을 상세히 분석하여 현재 다이어그램에 "
            "반영해 주세요.\n\n"
            "[회의록 텍스트]\n"
            f"{meeting_text}"
        )

        chat_request = ChatRequest(
            message=instruction_message,
            diagram=diagram_obj,
            history=[],
            projectContext=projectContext
        )

        # 5. Reuse LangGraph modify workflow
        return await modify_diagram(
            chat_request,
            session_id=sessionId
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            "회의 음성 처리 및 다이어그램 반영"
        )


# =====================================================================
# [기능 4] 다이어그램 Undo
# =====================================================================
@app.post(
    "/projects/undo-diagram/{session_id}",
    response_model=DiagramRes
)
async def undo_diagram(session_id: str):

    if (
        session_id not in db_diagram_snapshots
        or len(db_diagram_snapshots[session_id]) <= 1
    ):
        raise HTTPException(
            status_code=400,
            detail="되돌릴 수 있는 이전 히스토리가 없습니다."
        )

    db_diagram_snapshots[session_id].pop()

    previous_state = (
        db_diagram_snapshots[session_id][-1]
    )

    db_chat_history[session_id] = json.loads(
        json.dumps(
            previous_state["chat_history"]
        )
    )

    logger.info(
        f"Session {session_id} - "
        "Undo 성공 (다이어그램 및 대화 히스토리 동기화 완료)"
    )

    return DiagramRes(
        **previous_state["diagram"]
    )


# =====================================================================
# [기능 4-1] Session Reset
# =====================================================================
@app.delete(
    "/chat/{session_id}"
)
async def reset_chat(session_id: str):

    removed = False

    if session_id in db_chat_history:
        del db_chat_history[session_id]
        removed = True

    if session_id in db_diagram_snapshots:
        del db_diagram_snapshots[session_id]
        removed = True

    if removed:
        return {
            "message": f"Session {session_id} has been reset."
        }

    raise HTTPException(
        status_code=404,
        detail="세션을 찾을 수 없습니다."
    )


# =====================================================================
# [기능 5-1]
# 프로젝트 파일 트리 생성
# LangGraph: Generate → Validate → Retry
# =====================================================================
@app.post(
    "/projects/generate-file-tree",
    response_model=FileStructureResponse
)
async def generate_file_tree(
    request: FileTreeRequest
):

    system_instruction = (
        f"너는 다이어그램(JSON)을 보고 "
        f"소프트웨어 패키지 구조를 설계하는 아키텍트야.\n"
        f"제공된 구조를 바탕으로 "
        f"[{request.targetFramework}] 프로젝트에 필요한 "
        "파일 경로 목록을 작성해.\n"
        "실제 코드는 작성하지 말고, "
        "오직 파일 경로와 해당 파일의 간단한 역할만 JSON으로 응답해."
    )

    user_message = (
        "[설계된 다이어그램 구조]\n"
        f"{json.dumps(request.diagram.model_dump(), ensure_ascii=False)}\n\n"
        "위 구조를 바탕으로 생성해야 할 파일 트리를 "
        "스키마에 맞춰 뽑아줘."
    )

    initial_state: CodeGenerationState = {
        "mode": "file_tree",
        "system_instruction": system_instruction,
        "user_contents": [user_message],
        "target_file_path": None,
        "result": None,
        "validation_error": None,
        "retry_count": 0
    }

    try:
        result = code_agent_app.invoke(
            initial_state
        )

        if not result.get("result"):
            raise HTTPException(
                status_code=502,
                detail="파일 트리 생성에 실패했습니다."
            )

        return FileStructureResponse(
            **result["result"]
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            "파일 트리 생성"
        )


# =====================================================================
# [기능 5-2]
# 특정 단일 파일 소스 코드 생성
# LangGraph: Generate → Validate → Retry
# =====================================================================
@app.post(
    "/projects/generate-single-code",
    response_model=SingleCodeGenerationResponse
)
async def generate_single_code(
    request: SingleCodeGenerationRequest
):

    system_instruction = (
        "너는 다이어그램(JSON)을 실제 소스 코드로 변환하는 "
        "천재 개발자야.\n"
        f"전체 다이어그램 구조를 바탕으로, "
        f"요청받은 딱 하나의 파일 "
        f"[{request.targetFilePath}]의 소스 코드만 "
        "완성도 있게 작성해줘.\n"
        "다른 파일의 코드는 절대 포함하지 말고, "
        "지정된 스키마에 맞춰 이 파일의 순수 코드만 응답해."
    )

    user_message = (
        "[전체 다이어그램 구조]\n"
        f"{json.dumps(request.diagram.model_dump(), ensure_ascii=False)}\n\n"
        "[생성할 대상 파일 경로]\n"
        f"{request.targetFilePath}\n\n"
        f"위 파일 경로에 들어갈 "
        f"[{request.targetFramework}] 보일러플레이트 코드를 짜줘."
    )

    initial_state: CodeGenerationState = {
        "mode": "single_code",
        "system_instruction": system_instruction,
        "user_contents": [user_message],
        "target_file_path": request.targetFilePath,
        "result": None,
        "validation_error": None,
        "retry_count": 0
    }

    try:
        result = code_agent_app.invoke(
            initial_state
        )

        if not result.get("result"):
            raise HTTPException(
                status_code=502,
                detail=(
                    f"[{request.targetFilePath}] "
                    "코드 생성에 실패했습니다."
                )
            )

        return SingleCodeGenerationResponse(
            **result["result"]
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            f"[{request.targetFilePath}] 단일 코드 생성"
        )


# =====================================================================
# Main
# =====================================================================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=1234
    )
