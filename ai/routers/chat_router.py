from fastapi import APIRouter

from schemas.chat import ChatRequest, ChatResponse, ModifyResponse
from services.chat import ask_about_project, modify_diagram

router = APIRouter()


@router.post(
    "/project/ask",
    response_model=ChatResponse
)
async def chat_about_project(request: ChatRequest):
    return ask_about_project(request)


@router.post(
    "/project/agent",
    response_model=ModifyResponse
)
async def agent_modify_diagram(request: ChatRequest):
    return modify_diagram(request)

@router.post(
    "/project/benchmark-upgrade",
    response_model=BenchmarkAnalysisResponse
)
async def benchmark_and_upgrade(request: BenchmarkAnalysisRequest):
    return analyze_and_upgrade_diagram(request)