import os
from typing import Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv

# 1. 환경 변수 로드 (.env 파일에 GEMINI_API_KEY 저장 필수)
load_dotenv()

app = FastAPI(title="Gemini Multi-turn Agent")

# 2. Gemini 클라이언트 초기화
# 최신 google-genai SDK를 사용합니다.
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_ID = "gemini-2.5-flash"

# 3. 인메모리 세션 관리 (실제 서비스 시에는 Redis나 DB 권장)
# key: session_id, value: Chat object
chat_sessions: Dict[str, any] = {}

# 요청 데이터 구조 정의
class ChatRequest(BaseModel):
    session_id: str
    message: str

@app.post("/chat")
async def chat_with_agent(request: ChatRequest):
    session_id = request.session_id
    user_message = request.message

    try:
        # 4. 세션이 없으면 새로 생성, 있으면 기존 세션 활용
        if session_id not in chat_sessions:
            # 에이전트의 페르소나나 지침을 설정하려면 system_instruction 활용
            chat_sessions[session_id] = client.chats.create(
                model=MODEL_ID,
                config=types.GenerateContentConfig(
                    system_instruction="당신은 친절하고 유능한 AI 어시스턴트입니다."
                )
            )

        # 5. 멀티턴 메시지 전송
        # 이 메서드는 내부적으로 history를 자동으로 업데이트합니다.
        response = chat_sessions[session_id].send_message(user_message)
        
        # 6. 응답 반환
        return {
            "session_id": session_id,
            "reply": response.text,
            "status": "success"
        }

    except Exception as e:
        print(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail="서버 내부 오류가 발생했습니다.")

@app.delete("/chat/{session_id}")
async def reset_chat(session_id: str):
    """특정 세션의 대화 기록을 초기화합니다."""
    if session_id in chat_sessions:
        del chat_sessions[session_id]
        return {"message": f"Session {session_id} has been reset."}
    raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=1234)