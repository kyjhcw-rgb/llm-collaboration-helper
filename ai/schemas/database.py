from typing import Optional
from pydantic import BaseModel, Field

from schemas.common import DiagramRes


class DatabaseGenerateRequest(BaseModel):
    diagram: DiagramRes = Field(
        description="데이터베이스 구조를 분석할 최신 다이어그램"
    )
    dbType: str = Field(
        default="mysql",
        description="생성할 데이터베이스 종류 ('mysql' 또는 'postgresql')"
    )


class DatabaseDDLResponse(BaseModel):
    dbType: str = Field(description="선택된 데이터베이스 종류")
    sql: str = Field(description="생성된 DDL SQL 쿼리문")
    summary: Optional[str] = Field(
        default=None,
        description="생성된 테이블 및 스키마 구조 요약"
    )