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
# [기능 2] (신규) 다이어그램 초기 생성 기능 데이터 구조 및 API
# =====================================================================

# Spring Boot의 CanvasDtos.BlockDto 에 정확히 대응하는 스키마
class LlmBlockResponse(BaseModel):
    frontendId: str = Field(description="블록의 고유 ID (예: blk_auth_controller, blk_user_service)")
    parentFrontendId: Optional[str] = Field(default=None, description="계층 구조(Nesting)용 부모 블록의 frontendId. 최상위면 null")
    type: str = Field(description="FUNCTION, CLASS, INTERFACE, METHOD 중 하나")
    name: str = Field(description="블록에 표시될 이름 (예: AuthController, User, login)")
    description: str = Field(description="이 블록의 역할과 책임에 대한 짧은 설명")
    parameters: Optional[str] = Field(default=None, description="메서드인 경우 파라미터 정보 (예: String email, String pwd)")
    returnType: Optional[str] = Field(default=None, description="메서드인 경우 리턴 타입 (예: ResponseEntity)")
    annotations: Optional[str] = Field(default=None, description="스프링부트 어노테이션 등 (예: @RestController)")
    # posX, posY는 프론트엔드 오토 레이아웃을 위해 LLM 단계에서는 제외하거나 null 처리 가능

# Spring Boot의 CanvasDtos.EdgeDto 에 정확히 대응하는 스키마
class LlmEdgeResponse(BaseModel):
    frontendId: str = Field(description="엣지의 고유 ID (예: edge_1, edge_2)")
    sourceFrontendId: str = Field(description="출발지 블록의 frontendId")
    targetFrontendId: str = Field(description="목적지 블록의 frontendId")
    sourceHandle: Optional[str] = Field(default="bottom", description="출발 지점 핸들 (top, bottom, left, right)")
    targetHandle: Optional[str] = Field(default="top", description="도착 지점 핸들 (top, bottom, left, right)")
    type: str = Field(description="CALL (의존성/호출) 또는 INHERIT (상속/구현)")
    badgeCount: Optional[int] = Field(default=0, description="엣지에 표시할 뱃지 카운트")

# LLM이 최종적으로 반환할 JSON 최상위 구조
class InitialDiagramResponse(BaseModel):
    blocks: List[LlmBlockResponse]
    edges: List[LlmEdgeResponse]

# Spring Boot에서 넘어올 요청 바디 구조
class DiagramGenerationRequest(BaseModel):
    title: str
    framework: str
    freedomLevel: int
    descriptionPrompt: str

@app.post("/projects/initial-diagram", response_model=InitialDiagramResponse)
async def generate_initial_diagram(request: DiagramGenerationRequest):
    # LLM 페르소나 및 정교한 JSON 출력 지침
    system_instruction = (
        "너는 아키텍처 설계를 도와주는 시니어 개발자야.\n"
        "사용자의 기획과 프레임워크에 맞춰 초기 다이어그램 구조(블록 및 엣지)를 JSON으로 설계해.\n"
        "1. 각 블록은 반드시 고유하고 의미 있는 'frontendId'를 가져야 해.\n"
        "2. 기능(FUNCTION) 블록 안에 클래스(CLASS)가 들어가고, 클래스 안에 메서드(METHOD)가 들어가도록 'parentFrontendId'를 통해 계층(Nesting)을 명확히 해.\n"
        "3. 의존성 엣지(Edge)를 만들 때 'sourceFrontendId'와 'targetFrontendId'는 반드시 생성된 블록의 'frontendId'와 일치해야 해.\n"
        "절대 부연 설명 없이 지정된 JSON 스키마로만 응답해."
    )

    user_message = (
        f"프로젝트 제목: {request.title}\n"
        f"사용 프레임워크: {request.framework}\n"
        f"자유도 레벨: {request.freedomLevel} (높을수록 더 세분화된 디렉토리와 메서드까지 생성)\n"
        f"기획 내용: {request.descriptionPrompt}"
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=InitialDiagramResponse, # 💡 Pydantic 스키마 강제!
                temperature=0.2 # 창의성보다 일관된 아키텍처 규칙을 위해 낮게 설정
            )
        )
        
        # LLM이 반환한 텍스트는 완벽한 JSON 포맷이므로 파싱 후 리턴
        diagram_data = json.loads(response.text)
        return diagram_data

    except Exception as e:
        print(f"Diagram Gen Error: {e}")
        raise HTTPException(status_code=500, detail="다이어그램 생성 중 오류 발생")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=1234)
