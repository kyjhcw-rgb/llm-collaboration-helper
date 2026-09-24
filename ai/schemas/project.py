from typing import Dict

from pydantic import BaseModel, Field

from schemas.common import DiagramRes


class DiagramGenerationRequest(BaseModel):
    title: str
    framework: str
    freedomLevel: int
    descriptionPrompt: str


class DiagramToCodeRequest(BaseModel):
    diagram: DiagramRes = Field(description="코드로 변환할 다이어그램 구조")
    targetFramework: str = Field(
        description="타겟 프레임워크 (예: spring, java)"
    )
    basePackage: str = Field(
        default="com.example",
        description="Java 패키지 루트 (예: com.example)",
    )


class DiagramToCodeResponse(BaseModel):
    files: Dict[str, str] = Field(
        description="Key: 파일 경로, Value: 스켈레톤 소스 코드"
    )
