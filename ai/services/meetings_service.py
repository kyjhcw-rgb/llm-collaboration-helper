import json
import logging
from typing import List, Optional

from fastapi import HTTPException, UploadFile
from google.genai import types
from pydantic import BaseModel, Field

from agents.prompts import (
    meeting_description_instruction,
    meeting_description_user_message,
    meeting_extract_instruction,
    meeting_extract_user_message,
)
from core.config import MODEL_ID, client
from core.exceptions import handle_genai_error
from schemas.chat import ChatRequest, ModifyResponse
from schemas.common import DiagramRes
from services.chat_service import modify_diagram
from services.clova_service import request_clova_stt
from utils.diagram_helper import serialize_diagram, parse_diagram_json

logger = logging.getLogger(__name__)

NO_DIAGRAM_CHANGE_REPLY = "회의에서 다이어그램에 반영할 변경이 없습니다."
_CHANGE_MESSAGE_PREFIX = "다음 변경만 다이어그램에 반영하세요.\n"
_CHAT_MESSAGE_MAX_LENGTH = 4000


class MeetingChangeExtract(BaseModel):
    changes: List[str] = Field(
        default_factory=list,
        description="다이어그램에 반영할 변경. 없으면 빈 배열",
    )


def extract_diagram_changes(
    meeting_text: str,
    diagram: DiagramRes,
    project_context: Optional[str],
) -> List[str]:
    diagram_json = serialize_diagram(diagram)

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=meeting_extract_user_message(meeting_text),
        config=types.GenerateContentConfig(
            system_instruction=meeting_extract_instruction(
                diagram_json,
                project_context,
            ),
            response_mime_type="application/json",
            response_schema=MeetingChangeExtract,
            temperature=0.1,
        ),
    )

    payload = json.loads(response.text)
    raw = payload.get("changes") or []
    return [item.strip() for item in raw if isinstance(item, str) and item.strip()]


class ProjectDescriptionExtract(BaseModel):
    description: str = Field(
        default="",
        description="초기 다이어그램 생성용 프로젝트 설명",
    )


def extract_project_description(meeting_text: str) -> str:
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=meeting_description_user_message(meeting_text),
        config=types.GenerateContentConfig(
            system_instruction=meeting_description_instruction(),
            response_mime_type="application/json",
            response_schema=ProjectDescriptionExtract,
            temperature=0.2,
        ),
    )

    payload = json.loads(response.text)
    description = payload.get("description") or ""
    return description.strip() if isinstance(description, str) else ""


def _changes_to_agent_message(changes: List[str]) -> str:
    body = "\n".join(f"- {item}" for item in changes)
    message = f"{_CHANGE_MESSAGE_PREFIX}{body}"
    if len(message) <= _CHAT_MESSAGE_MAX_LENGTH:
        return message
    return message[:_CHAT_MESSAGE_MAX_LENGTH]


async def process_meeting_audio(
    file: UploadFile,
    current_diagram: str,
    project_context: Optional[str],
    session_id: Optional[str]
) -> ModifyResponse:
    try:
        audio_bytes = await file.read()

        if not audio_bytes:
            raise HTTPException(
                status_code=400,
                detail="업로드된 음성 파일이 비어있습니다."
            )

        meeting_text = request_clova_stt(
            file_bytes=audio_bytes,
            filename=file.filename,
            content_type=file.content_type
        )

        if not meeting_text.strip():
            raise HTTPException(
                status_code=400,
                detail="음성에서 인식된 회의 내용 텍스트가 없습니다."
            )

        logger.info(f"Session [{session_id}] - STT 변환 완료:\n{meeting_text}")

        # Helper 함수를 활용한 파싱 처리
        diagram_obj = parse_diagram_json(current_diagram)

        changes = extract_diagram_changes(
            meeting_text,
            diagram_obj,
            project_context,
        )

        logger.info(
            f"Session [{session_id}] - 추출된 다이어그램 변경 "
            f"{len(changes)}건: {changes}"
        )

        if not changes:
            return ModifyResponse(
                reply=NO_DIAGRAM_CHANGE_REPLY,
                diagram=diagram_obj,
            )

        chat_request = ChatRequest(
            message=_changes_to_agent_message(changes),
            diagram=diagram_obj,
            history=[],
            projectContext=project_context,
        )

        return modify_diagram(chat_request)

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(e, "회의 음성 처리 및 다이어그램 반영")


def process_meeting_description(file: UploadFile) -> str:
    try:
        audio_bytes = file.file.read()

        if not audio_bytes:
            raise HTTPException(
                status_code=400,
                detail="업로드된 음성 파일이 비어있습니다."
            )

        meeting_text = request_clova_stt(
            file_bytes=audio_bytes,
            filename=file.filename,
            content_type=file.content_type
        )

        if not meeting_text.strip():
            raise HTTPException(
                status_code=400,
                detail="음성에서 인식된 회의 내용 텍스트가 없습니다."
            )

        logger.info(f"초기 설계 회의 STT 변환 완료:\n{meeting_text}")

        description = extract_project_description(meeting_text)

        if not description:
            raise HTTPException(
                status_code=502,
                detail="회의에서 프로젝트 설명을 정리하지 못했습니다."
            )

        return description

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(e, "회의 음성 기반 프로젝트 설명 정리")