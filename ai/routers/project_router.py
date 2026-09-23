from fastapi import APIRouter

from schemas.common import DiagramRes
from schemas.project import DiagramGenerationRequest
from services.project_service import generate_initial_diagram

router = APIRouter()


@router.post(
    "/projects/initial-diagram",
    response_model=DiagramRes
)
async def initial_diagram(request: DiagramGenerationRequest):
    return generate_initial_diagram(request)
