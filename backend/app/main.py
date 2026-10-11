from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import get_client, init_db
from .api.routes_auth import router as auth_router
from .api.routes_chat import router as chat_router
from .api.routes_documents import router as documents_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize MongoDB indexes
    try:
        init_db()
        print("[MongoDB] Indexes initialized successfully.")
    except Exception as exc:
        print(f"[MongoDB] Warning: Could not initialize indexes: {exc}")
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)


allowed_origins = list(dict.fromkeys(
    [
        *settings.cors_origins,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(chat_router)


@app.get("/api/health")
def health():
    db_status = "connected"
    try:
        client = get_client()
        client.admin.command("ping")
    except Exception as exc:
        db_status = f"disconnected: {exc}"

    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "database": "mongodb",
        "database_status": db_status,
        "llm_backend": settings.llm_backend,
        "llm_model": settings.llm_model,
    }


@app.get("/")
def root():
    return {
        "message": "Adaptive Multi-RAG API (MongoDB)",
        "docs": "/docs",
    }