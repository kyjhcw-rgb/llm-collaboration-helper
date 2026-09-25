from fastapi import FastAPI

from core.logger import setup_logging
from routers import chat_router, database_router, meetings_router, project_router

setup_logging()

app = FastAPI(title="Our Diagram AI Agent (LangGraph Edition)")

app.include_router(chat_router.router)
app.include_router(meetings_router.router)
app.include_router(project_router.router)
app.include_router(database_router.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=1234
    )
