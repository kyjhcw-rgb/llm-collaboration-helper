import os
import json
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from dotenv import load_dotenv

# 1. 환경 변수 로드 (.env 파일에 GEMINI_API_KEY 저장 필수)
load_dotenv()

app = FastAPI(title="Our Diagram AI Agent")

# 2. Gemini 클라이언트 초기화 (최신 SDK)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
# 정형화된 JSON을 뽑아내는 데는 가성비와 속도가 뛰어난 flash 모델을 우선 사용합니다.
MODEL_ID = "gemini-2.5-flash" 

# 3. 인메모리 세션 관리 (일반 채팅용)
chat_sessions: Dict[str, any] = {}

# =====================================================================
# [기능 1] 기존 멀티턴 채팅 기능 데이터 구조 및 API
# =====================================================================
class ChatRequest(BaseModel):
    session_id: str
    message: str

@app.post("/chat")
async def chat_with_agent(request: ChatRequest):
    session_id = request.session_id
    user_message = request.message

    try:
        if session_id not in chat_sessions:
            chat_sessions[session_id] = client.chats.create(
                model=MODEL_ID,
                config=types.GenerateContentConfig(
                    system_instruction="당신은 친절하고 유능한 소프트웨어 아키텍트 멘토입니다."
                )
            )

        response = chat_sessions[session_id].send_message(user_message)
        
        return {
            "session_id": session_id,
            "reply": response.text,
            "status": "success"
        }
    except Exception as e:
        print(f"Chat Error: {e}")
        raise HTTPException(status_code=500, detail="채팅 서버 내부 오류가 발생했습니다.")

@app.delete("/chat/{session_id}")
async def reset_chat(session_id: str):
    if session_id in chat_sessions:
        del chat_sessions[session_id]
        return {"message": f"Session {session_id} has been reset."}
    raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")


# =====================================================================
# [기능 2] 다이어그램 초기 생성 — Spring TranslationDtos.DiagramRes 계약
# =====================================================================

# Spring Boot TranslationDtos 와 1:1 대응 (좌표·핸들 등 UI 필드는 Spring TranslationMapper 가 처리)
class MethodNode(BaseModel):
    id: str = Field(description="고유 ID (예: method_login)")
    name: str = Field(description="메서드 이름 (예: login)")
    description: str = Field(default="", description="메서드 역할 설명")
    parameters: Optional[str] = Field(default=None, description="파라미터 (예: String email, String pwd)")
    returnType: Optional[str] = Field(default=None, description="리턴 타입 (예: ResponseEntity)")


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
    fromId: str = Field(description="출발 노드 id (class 또는 method)")
    to: str = Field(description="도착 노드 id")
    kind: str = Field(description="CALL, INHERIT, IMPLEMENT 중 하나")


class DiagramRes(BaseModel):
    features: List[FeatureNode]
    edges: List[RelationEdge] = Field(default_factory=list)


# Spring Boot CreateReq 와 동일한 요청 바디
class DiagramGenerationRequest(BaseModel):
    title: str
    framework: str
    freedomLevel: int
    descriptionPrompt: str


def _freedom_level_hint(level: int) -> str:
    if level <= 1:
        return "feature와 class 위주로 설계하고, method는 핵심만 최소한으로 포함해."
    if level == 2:
        return "주요 class와 핵심 method를 포함하고, edges로 주요 의존 관계를 표현해."
    return "class와 method를 세분화하고, edges도 풍부하게 포함해."


@app.post("/projects/initial-diagram", response_model=DiagramRes)
async def generate_initial_diagram(request: DiagramGenerationRequest):
    system_instruction = (
        "너는 소프트웨어 아키텍처를 설계하는 시니어 개발자야.\n"
        "사용자 기획에 맞춰 초기 다이어그램을 JSON으로 설계해.\n"
        "\n"
        "구조 규칙:\n"
        "1. features: 도메인·기능 단위 (id, name, description)\n"
        "2. 각 feature 안에 classes 배열 (클래스·인터페이스)\n"
        "3. 각 class 안에 methods 배열 (parameters, returnType 포함)\n"
        "4. edges: 노드 간 관계. fromId, to는 반드시 위에서 만든 id와 일치해야 해\n"
        "5. edges.kind: CALL(호출·의존), INHERIT(상속), IMPLEMENT(구현)\n"
        "6. 좌표, parentId, handle, frontendId 등 UI·캔버스 필드는 출력하지 마\n"
        "7. 모든 id는 고유하고 의미 있게 (예: feat_auth, cls_user_service, method_login)\n"
        "절대 부연 설명 없이 지정된 JSON 스키마로만 응답해."
    )

    user_message = (
        f"프로젝트 제목: {request.title}\n"
        f"사용 프레임워크: {request.framework}\n"
        f"자유도 레벨: {request.freedomLevel} — {_freedom_level_hint(request.freedomLevel)}\n"
        f"기획 내용: {request.descriptionPrompt}"
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
        return diagram_data

    except Exception as e:
        print(f"Diagram Gen Error: {e}")
        raise HTTPException(status_code=500, detail="다이어그램 생성 중 오류 발생")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=1234)
