import json
import logging
from typing import Optional

from fastapi import HTTPException, UploadFile

from core.exceptions import handle_genai_error
from schemas.chat import ChatRequest, ModifyResponse
from schemas.common import DiagramRes
from services.chat import modify_diagram
from services.clova import request_clova_stt

logger = logging.getLogger(__name__)


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

        logger.info(
            f"Session [{session_id}] - STT 변환 완료:\n"
            f"{meeting_text}"
        )

        try:
            diagram_dict = json.loads(current_diagram)
            diagram_obj = DiagramRes(**diagram_dict)
        except Exception as parse_err:
            logger.error(
                f"다이어그램 JSON 파싱 에러: {parse_err}"
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    "전달받은 currentDiagram JSON 형식이 "
                    "올바르지 않습니다."
                )
            )

        instruction_message = (
            "다음은 진행된 개발 회의 녹음의 STT 변환 텍스트입니다. "
            "회의 내용을 상세히 분석하여 현재 다이어그램에 "
            "반영해 주세요.\n\n"
            "[회의록 텍스트]\n"
            f"{meeting_text}"
        )

        chat_request = ChatRequest(
            message=instruction_message,
            diagram=diagram_obj,
            history=[],
            projectContext=project_context
        )

        return modify_diagram(chat_request)

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(
            e,
            "회의 음성 처리 및 다이어그램 반영"
        )
