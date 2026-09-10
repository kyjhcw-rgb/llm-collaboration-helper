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

class SimilarServiceDetail(BaseModel):
    name: str = Field(description="유사 서비스 이름 (예: Tinder)")
    keyFeatures: List[str] = Field(description="해당 서비스의 핵심 아키텍처 특징 (예: ['Redis 기반 실시간 매칭', 'WebSocket 채팅'])")
    comparison: str = Field(description="현재 우리 프로젝트와의 구조적 차이점 분석")


class BenchmarkAnalysisResponse(BaseModel):
    similarServices: List[SimilarServiceDetail] = Field(
        description="벤치마킹한 유사 서비스들의 상세 분석 정보"
    )
    improvements: str = Field(
        description="유사 서비스 대비 우리 아키텍처의 종합 개선점 및 방향성 (한국어)"
    )
    diagram: DiagramRes = Field(
        description="개선 사항이 추가/수정된 반영 다이어그램"
    )