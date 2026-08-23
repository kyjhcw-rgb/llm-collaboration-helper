from fastapi import FastAPI

from core.logger import setup_logging
from routers import chat, meetings, project

setup_logging()

app = FastAPI(title="Our Diagram AI Agent (LangGraph Edition)")

app.include_router(chat.router)
app.include_router(meetings.router)
app.include_router(project.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=1234
    )
