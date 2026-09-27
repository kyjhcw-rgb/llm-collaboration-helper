from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from schemas.chat import ModifyResponse
from services.meetings_service import process_meeting_audio, process_meeting_description

router = APIRouter()


class MeetingDescriptionResponse(BaseModel):
    description: str


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


# Clova/LLM 호출이 모두 동기라 def로 둬서 스레드풀에서 실행되게 한다.
@router.post(
    "/projects/meeting-description",
    response_model=MeetingDescriptionResponse
)
def meeting_description_endpoint(file: UploadFile = File(...)):
    return MeetingDescriptionResponse(description=process_meeting_description(file))
