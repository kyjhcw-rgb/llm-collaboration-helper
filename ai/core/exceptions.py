import logging

from fastapi import HTTPException
from google.genai import errors

logger = logging.getLogger(__name__)


def handle_genai_error(e: Exception, context_msg: str):
    logger.error(
        f"{context_msg} 에러: {str(e)}",
        exc_info=True
    )

    if isinstance(e, HTTPException):
        raise e

    if isinstance(e, errors.APIError):
        status_code = getattr(e, "code", 500)

        if status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요."
            )

        if status_code in (401, 403):
            raise HTTPException(
                status_code=401,
                detail="API 인증 오류입니다. API 키를 확인해주세요."
            )

        if status_code == 400:
            raise HTTPException(
                status_code=400,
                detail="잘못된 요청입니다. (JSON 스키마 파싱 오류 또는 모델 제약 위반)"
            )

        raise HTTPException(
            status_code=502,
            detail=f"Gemini API 통신 오류: {getattr(e, 'message', str(e))}"
        )

    raise HTTPException(
        status_code=500,
        detail=f"{context_msg} 중 서버 내부 오류가 발생했습니다."
    )
