import json
import logging

import requests
from fastapi import HTTPException

from core.config import CLOVA_INVOKE_URL, CLOVA_SECRET_KEY

logger = logging.getLogger(__name__)


def request_clova_stt(
    file_bytes: bytes,
    filename: str,
    content_type: str = "audio/webm"
) -> str:
    """Clova Speech API를 호출하여 화자 분리 STT 텍스트를 반환한다."""

    if not CLOVA_SECRET_KEY:
        logger.error("CLOVA_SECRET_KEY 환경 변수가 설정되지 않았습니다.")
        raise HTTPException(
            status_code=500,
            detail="Clova STT API 키 설정이 누락되었습니다."
        )

    request_url = f"{CLOVA_INVOKE_URL.rstrip('/')}/recognizer/upload"

    params = {
        "language": "ko-KR",
        "completion": "sync",
        "diarization": {"enable": True}
    }

    headers = {
        "X-CLOVASPEECH-API-KEY": CLOVA_SECRET_KEY
    }

    files = {
        "media": (
            filename or "meeting_audio.webm",
            file_bytes,
            content_type or "audio/webm"
        ),
        "params": (
            None,
            json.dumps(params),
            "application/json"
        )
    }

    try:
        response = requests.post(
            request_url,
            headers=headers,
            files=files
        )

        if response.status_code != 200:
            logger.error(
                f"Clova STT API Error: "
                f"{response.status_code} - {response.text}"
            )
            raise HTTPException(
                status_code=502,
                detail=f"Clova STT 변환 실패 (상태 코드: {response.status_code})"
            )

        res = response.json()
        segments = res.get("segments", [])

        if segments:
            formatted_text = [
                f"[{seg.get('speaker', {}).get('name', '참여자')}]: "
                f"{seg.get('text', '')}"
                for seg in segments
            ]
            return "\n".join(formatted_text)

        return res.get("text", "")

    except HTTPException:
        raise
    except requests.RequestException as e:
        logger.error(f"Clova STT 통신 실패: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail="Clova STT 서버와의 통신 중 오류가 발생했습니다."
        )
