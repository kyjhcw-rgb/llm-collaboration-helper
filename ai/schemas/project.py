from typing import Dict

from pydantic import BaseModel, Field

from schemas.common import DiagramRes


class DiagramGenerationRequest(BaseModel):
    title: str
    framework: str
    freedomLevel: int
    descriptionPrompt: str


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
 