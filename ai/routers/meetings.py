from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from schemas.chat import ModifyResponse
from services.meetings import process_meeting_audio

router = APIRouter()


@router.post(
    "/projects/process-meeting-audio",
    response_model=ModifyResponse
)
async def process_meeting_audio_endpoint(
    sessionId: Optional[str] = Form(None),
    currentDiagram: str = Form(...),
    projectContext: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    return await process_meeting_audio(
        file=file,
        current_diagram=currentDiagram,
        project_context=projectContext,
        session_id=sessionId
    )
