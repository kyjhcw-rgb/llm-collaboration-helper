import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
from dotenv import load_dotenv

load_dotenv()
AI_URL = os.getenv("AI_URL")
AI_MODEL = os.getenv("AI_MODEL")
app = FastAPI()

class ChatRequest(BaseModel):
    prompt: str

@app.get("/")
def read_root():
    return {"status": "Running", "model" : AI_MODEL}

@app.post("/chat")
def chat_with_llm(request: ChatRequest):
    payload = {
        "model": AI_MODEL,
        "prompt": request.prompt,
        "stream": False
    }

    try:
        print(f"질문: {request.prompt}")
        response = requests.post(AI_URL, json=payload)
        response.raise_for_status()
        
        result = response.json()
        answer = result.get("response", "")
        
        print(f"답변: {answer[:30]}...")
        return {"response": answer}

    except Exception as e:
        print(f"❌ 에러 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))