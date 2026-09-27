from fastapi import APIRouter

from schemas.database import DatabaseDDLResponse, DatabaseGenerateRequest
from services.database import generate_database_ddl

router = APIRouter()


# LLM 호출/재시도가 모두 동기라 def로 둬서 스레드풀에서 실행되게 한다.
@router.post(
    "/projects/generate-database-ddl",
    response_model=DatabaseDDLResponse
)
def generate_database_ddl_endpoint(request: DatabaseGenerateRequest):
    return generate_database_ddl(request)
