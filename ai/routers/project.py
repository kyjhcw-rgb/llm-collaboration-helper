from fastapi import APIRouter

from schemas.common import DiagramRes
from schemas.project import (
    DiagramGenerationRequest,
    FileStructureResponse,
    FileTreeRequest,
    SingleCodeGenerationRequest,
    SingleCodeGenerationResponse,
)
from services.project import (
    generate_file_tree,
    generate_initial_diagram,
    generate_single_code,
)

router = APIRouter()


@router.post(
    "/projects/initial-diagram",
    response_model=DiagramRes
)
async def initial_diagram(request: DiagramGenerationRequest):
    return generate_initial_diagram(request)


@router.post(
    "/projects/generate-file-tree",
    response_model=FileStructureResponse
)
async def generate_file_tree_endpoint(request: FileTreeRequest):
    return generate_file_tree(request)


@router.post(
    "/projects/generate-single-code",
    response_model=SingleCodeGenerationResponse
)
async def generate_single_code_endpoint(request: SingleCodeGenerationRequest):
    return generate_single_code(request)
