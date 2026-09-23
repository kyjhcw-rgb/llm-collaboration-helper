from fastapi import APIRouter

from schemas.common import DiagramRes
from schemas.project import (
    DiagramGenerationRequest,
    DiagramToCodeRequest,
    DiagramToCodeResponse,
)
from services.project_service import (
    generate_code_from_diagram,
    generate_initial_diagram,
)

router = APIRouter()


@router.post(
    "/projects/initial-diagram",
    response_model=DiagramRes
)
async def initial_diagram(request: DiagramGenerationRequest):
    return generate_initial_diagram(request)


@router.post(
    "/projects/diagram-to-code",
    response_model=DiagramToCodeResponse,
)
async def diagram_to_code(request: DiagramToCodeRequest):
    return generate_code_from_diagram(request)
