from fastapi import APIRouter

from schemas.database import DatabaseDDLResponse, DatabaseGenerateRequest
from services.database import generate_database_ddl

router = APIRouter()


@router.post(
    "/projects/generate-database-ddl",
    response_model=DatabaseDDLResponse
)
async def generate_database_ddl_endpoint(request: DatabaseGenerateRequest):
    return await generate_database_ddl(request)