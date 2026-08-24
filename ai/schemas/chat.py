from typing import List, Optional

from pydantic import BaseModel, Field

from schemas.common import DiagramRes


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
