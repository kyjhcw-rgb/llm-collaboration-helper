import os
import json
import logging
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from google import genai
from google.genai import types, errors
from dotenv import load_dotenv

# =====================================================================
# 로깅 (Logging) 설정
# =====================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# 1. 환경 변수 로드 (.env 파일에 GEMINI_API_KEY 저장 필수)
load_dotenv()

app = FastAPI(title="Our Diagram AI Agent")

# 2. Gemini 클라이언트 초기화 (최신 SDK)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_ID = "gemini-2.5-flash" 

# =====================================================================
# 상태 관리를 위한 모의 DB 저장소 (프로덕션에서는 DB 전환 권장)
# =====================================================================
db_chat_history: Dict[str, List[dict]] = {}

# 구조: { session_id: [ {"diagram": dict, "chat_history": list}, ... ] }
db_diagram_snapshots: Dict[str, List[dict]] = {}


# =====================================================================
# Pydantic 데이터 구조 정의 (다이어그램 도메인 - 모두 snake_case로 통일)
# =====================================================================
class MethodNode(BaseModel):
    id: str = Field(description="고유 ID (예: method_login)")
    name: str = Field(description="메서드 이름 (예: login)")
    description: str = Field(default="", description="메서드 역할 설명")
    parameters: Optional[str] = Field(default=None, description="파라미터 (예: String email, String pwd)")
    return_type: Optional[str] = Field(default=None, description="리턴 타입 (예: ResponseEntity)") # returnType -> return_type 변경

class ClassNode(BaseModel):
    id: str = Field(description="고유 ID (예: cls_auth_controller)")
    name: str = Field(description="클래스·인터페이스 이름")
    description: str = Field(default="", description="클래스 역할 설명")
    annotations: Optional[str] = Field(default=None, description="어노테이션 (예: @RestController)")
    methods: List[MethodNode] = Field(default_factory=list)

class FeatureNode(BaseModel):
    id: str = Field(description="고유 ID (예: feat_auth)")
    name: str = Field(description="도메인·기능 단위 이름")
    description: str = Field(default="", description="기능 설명")
    classes: List[ClassNode] = Field(default_factory=list)

class RelationEdge(BaseModel):
    id: str = Field(description="엣지 고유 ID (예: edge_1)")
    from_id: str = Field(description="출발 노드 id (class 또는 method)") # fromId -> from_id 변경
    to: str = Field(description="도착 노드 id")
    kind: str = Field(description="CALL, INHERIT, IMPLEMENT 중 하나")

class DiagramRes(BaseModel):
    features: List[FeatureNode]
    edges: List[RelationEdge] = Field(default_factory=list)

# 다이어그램 생성 및 수정 요청 스키마
class DiagramGenerationRequest(BaseModel):
    title: str
    framework: str
    freedom_level: int # freedomLevel -> freedom_level 변경
    description_prompt: str # descriptionPrompt -> description_prompt 변경

class DiagramModificationRequest(BaseModel):
    session_id: str
    current_diagram: DiagramRes = Field(description="현재 캔버스에 존재하는 최신 다이어그램 구조")
    instruction: str = Field(description="사용자의 수정 요청 사항")


# =====================================================================
# 2단계 코드 생성을 위한 Pydantic 스키마
# =====================================================================
class FileTreeRequest(BaseModel):
    diagram: DiagramRes = Field(description="코드로 변환할 최신 다이어그램 구조")
    target_framework: str = Field(description="변환할 타겟 프레임워크")

class FileStructureResponse(BaseModel):
    file_paths: Dict[str, str] = Field(description="Key: 파일 경로, Value: 파일의 역할 요약")

class SingleCodeGenerationRequest(BaseModel):
    diagram: DiagramRes = Field(description="최신 다이어그램 구조")
    target_framework: str = Field(description="타겟 프레임워크")
    target_file_path: str = Field(description="코드를 생성할 대상 파일 경로")

class SingleCodeGenerationResponse(BaseModel):
    file_path: str
    code: str = Field(description="해당 파일의 완벽한 소스 코드 내용")


# =====================================================================
# [내부 유틸리티 함수]
# =====================================================================
def validate_and_filter_edges(diagram: dict) -> dict:
    valid_ids = set()
    for feature in diagram.get("features", []):
        if feature.get("id"): valid_ids.add(feature.get("id"))
        for cls in feature.get("classes", []):
            if cls.get("id"): valid_ids.add(cls.get("id"))
            for method in cls.get("methods", []):
                if method.get("id"): valid_ids.add(method.get("id"))

    clean_edges = []
    for edge in diagram.get("edges", []):
        from_id = edge.get("from_id") # fromId -> from_id로 대칭 수정
        to_id = edge.get("to")
        if from_id in valid_ids and to_id in valid_ids:
            clean_edges.append(edge)
        else:
            logger.warning(f"유령 엣지가 감지되어 제거되었습니다: {edge.get('id')}")

    diagram["edges"] = clean_edges
    return diagram

def _freedom_level_hint(level: int) -> str:
    if level <= 1: return "feature와 class 위주로 설계하고, method는 핵심만 최소한으로 포함해."
    if level == 2: return "주요 class와 핵심 method를 포함하고, edges로 주요 의존 관계를 표현해."
    return "class와 method를 세분화하고, edges도 풍부하게 포함해."


# =====================================================================
# 예외 처리 중앙화 헬퍼 함수
# =====================================================================
def handle_genai_error(e: Exception, context_msg: str):
    logger.error(f"{context_msg} 에러: {str(e)}", exc_info=True)
    
    if isinstance(e, errors.APIError):
        status_code = getattr(e, 'code', 500)
        
        if status_code == 429:
            raise HTTPException(status_code=429, detail="API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요.")
        elif status_code in (401, 403):
            raise HTTPException(status_code=401, detail="API 인증 오류입니다. API 키를 확인해주세요.")
        elif status_code == 400:
            raise HTTPException(status_code=400, detail="잘못된 요청입니다. (JSON 스키마 파싱 오류 또는 모델 제약 위반)")
        else:
            raise HTTPException(status_code=502, detail=f"Gemini API 통신 오류: {getattr(e, 'message', str(e))}")
            
    raise HTTPException(status_code=500, detail=f"{context_msg} 중 서버 내부 오류가 발생했습니다.")


# =====================================================================
# [기능 1] 프로젝트 다이어그램 기반 챗봇 (stateless, Spring 연동)
# =====================================================================
class ChatHistoryTurn(BaseModel):
    sender: str
    message: str

class ChatRequest(BaseModel):
    message: str = Field(..., max_length=4000)
    diagram: DiagramRes
    history: List[ChatHistoryTurn] = Field(default_factory=list)
    projectContext: Optional[str] = Field(default=None, description="프로젝트 초기 기획 설명")

class ChatResponse(BaseModel):
    reply: str

@app.post("/chat", response_model=ChatResponse)
async def chat_about_project(request: ChatRequest):
    diagram_json = json.dumps(request.diagram.model_dump(), ensure_ascii=False)
    context_block = ""
    if request.projectContext:
        context_block = f"\n[프로젝트 초기 기획]\n{request.projectContext}\n"

    system_instruction = (
        "당신은 소프트웨어 아키텍처를 설명하는 AI 어시스턴트입니다.\n"
        "아래 [프로젝트 다이어그램] JSON만 근거로 답하세요.\n"
        "다이어그램에 없는 내용은 추측하지 말고, 모르면 '다이어그램에 해당 정보가 없습니다'라고 답하세요.\n"
        f"{context_block}"
        f"[프로젝트 다이어그램]\n{diagram_json}"
    )

    contents = []
    for turn in request.history:
        role = "user" if turn.sender.upper() == "USER" else "model"
        contents.append({"role": role, "parts": [{"text": turn.message}]})
    contents.append({"role": "user", "parts": [{"text": request.message}]})

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
            ),
        )
        return ChatResponse(reply=response.text)
    except Exception as e:
        handle_genai_error(e, "프로젝트 챗봇 응답 생성")


# =====================================================================
# [기능 2] 다이어그램 초기 생성 API (stateless — DB 저장은 Spring)
# =====================================================================
@app.post("/projects/initial-diagram", response_model=DiagramRes)
async def generate_initial_diagram(request: DiagramGenerationRequest):
    system_instruction = (
        "너는 소프트웨어 아키텍처를 설계하는 시니어 개발자야.\n"
        "사용자 기획에 맞춰 초기 다이어그램을 JSON으로 설계해.\n"
        "구조 규칙:\n"
        "1. features: 도메인·기능 단위 (id, name, description)\n"
        "2. 각 feature 안에 classes 배열\n"
        "3. 각 class 안에 methods 배열\n"
        "4. edges: 노드 간 관계. from_id, to는 반드시 위에서 만든 id와 일치\n"  # 프롬프트 가이드 내 fromId -> from_id 변경
        "5. edges.kind: CALL, INHERIT, IMPLEMENT\n"
        "6. 절대 부연 설명 없이 지정된 JSON 스키마로만 응답해."
    )

    user_message = (
        f"프로젝트 제목: {request.title}\n"
        f"사용 프레임워크: {request.framework}\n"
        f"자유도 레벨: {request.freedom_level} — {_freedom_level_hint(request.freedom_level)}\n"
        f"기획 내용: {request.description_prompt}"
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=DiagramRes,
                temperature=0.2,
            ),
        )

        diagram_data = json.loads(response.text)
        validated_diagram = validate_and_filter_edges(diagram_data)
        return validated_diagram
    except Exception as e:
        handle_genai_error(e, "다이어그램 초기 생성")


# =====================================================================
# [기능 3] 다이어그램 지속 수정 API
# =====================================================================
@app.post("/projects/modify-diagram", response_model=DiagramRes)
async def modify_diagram(request: DiagramModificationRequest):
    session_id = request.session_id
    
    system_instruction = (
        "너는 소프트웨어 아키텍처 다이어그램을 수정하고 고도화하는 시니어 개발자야.\n"
        "사용자가 제공한 [현재 상태]와 [수정 요청]을 분석해 전체 다이어그램을 JSON으로 응답해.\n"
        "변환 규칙:\n"
        "1. ID 유지: 명시적 삭제/변경이 없는 기존 feature, class, method ID는 절대 유지\n"
        "2. 노드 추가: 기존 ID와 겹치지 않는 고유 ID 부여\n"
        "3. edges 동기화: 노드 변경에 맞춰 갱신\n"
        "4. 순수 JSON 응답 필수"
    )

    history = db_chat_history.get(session_id, [])
    user_message_text = (
        f"[현재 다이어그램 상태]\n{json.dumps(request.current_diagram.model_dump(), ensure_ascii=False)}\n\n"
        f"[사용자 수정 요청 사항]\n{request.instruction}"
    )
    history.append({"role": "user", "parts": [{"text": user_message_text}]})

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=DiagramRes,
                temperature=0.2,
            ),
        )

        history.append({"role": "model", "parts": [{"text": response.text}]})
        db_chat_history[session_id] = history

        updated_diagram_data = json.loads(response.text)
        validated_diagram = validate_and_filter_edges(updated_diagram_data)
        
        if session_id not in db_diagram_snapshots:
            db_diagram_snapshots[session_id] = []
            
        db_diagram_snapshots[session_id].append({
            "diagram": json.loads(json.dumps(validated_diagram)),
            "chat_history": json.loads(json.dumps(history))
        })
        
        return validated_diagram
    except Exception as e:
        handle_genai_error(e, "다이어그램 수정")


# =====================================================================
# [기능 4] 다이어그램 되돌리기 (Undo) 및 세션 초기화
# =====================================================================
@app.post("/projects/undo-diagram/{session_id}", response_model=DiagramRes)
async def undo_diagram(session_id: str):
    if session_id not in db_diagram_snapshots or len(db_diagram_snapshots[session_id]) <= 1:
        raise HTTPException(status_code=400, detail="되돌릴 수 있는 이전 히스토리가 없습니다.")
    
    db_diagram_snapshots[session_id].pop()
    previous_state = db_diagram_snapshots[session_id][-1]
    db_chat_history[session_id] = json.loads(json.dumps(previous_state["chat_history"]))
    
    logger.info(f"Session {session_id} - Undo 성공 (다이어그램 및 대화 히스토리 동기화 완료)")
    return previous_state["diagram"]


@app.delete("/chat/{session_id}")
async def reset_chat(session_id: str):
    removed = False
    if session_id in db_chat_history:
        del db_chat_history[session_id]
        removed = True
    if session_id in db_diagram_snapshots:
        del db_diagram_snapshots[session_id]
        removed = True
        
    if removed:
        return {"message": f"Session {session_id} has been reset."}
    raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")


# =====================================================================
# [기능 5-1] 1단계: 프로젝트 파일 트리(구조)만 생성
# =====================================================================
@app.post("/projects/generate-file-tree", response_model=FileStructureResponse)
async def generate_file_tree(request: FileTreeRequest):
    system_instruction = (
        f"너는 다이어그램(JSON)을 보고 소프트웨어 패키지 구조를 설계하는 아키텍트야.\n"
        f"제공된 구조를 바탕으로 [{request.target_framework}] 프로젝트에 필요한 파일 경로 목록을 작성해.\n"
        "실제 코드는 작성하지 말고, 오직 파일 경로와 해당 파일의 간단한 역할만 JSON으로 응답해."
    )

    user_message = (
        f"[설계된 다이어그램 구조]\n{json.dumps(request.diagram.model_dump(), ensure_ascii=False)}\n\n"
        f"위 구조를 바탕으로 생성해야 할 파일 트리를 스키마에 맞춰 뽑아줘."
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=FileStructureResponse,
                temperature=0.1,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        handle_genai_error(e, "파일 트리 생성")


# =====================================================================
# [기능 5-2] 2단계: 특정 단일 파일의 실제 소스 코드 생성
# =====================================================================
@app.post("/projects/generate-single-code", response_model=SingleCodeGenerationResponse)
async def generate_single_code(request: SingleCodeGenerationRequest):
    system_instruction = (
        f"너는 다이어그램(JSON)을 실제 소스 코드로 변환하는 천재 개발자야.\n"
        f"전체 다이어그램 구조를 바탕으로, 요청받은 딱 하나의 파일 [{request.target_file_path}] 의 소스 코드만 완성도 있게 작성해줘.\n"
        "다른 파일의 코드는 절대 포함하지 말고, 지정된 스키마에 맞춰 이 파일의 순수 코드만 응답해."
    )
    
    user_message = (
        f"[전체 다이어그램 구조]\\n{json.dumps(request.diagram.model_dump(), ensure_ascii=False)}\n\n"
        f"[생성할 대상 파일 경로]\n{request.target_file_path}\n\n"
        f"위 파일 경로에 들어갈 [{request.target_framework}] 보일러플레이트 코드를 짜줘."
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=SingleCodeGenerationResponse,
                temperature=0.3,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        handle_genai_error(e, f"[{request.target_file_path}] 단일 코드 생성")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=1234)
