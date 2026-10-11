from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    app_name: str = "Adaptive Multi-RAG"
    app_version: str = "1.0.0"

    # Database (MongoDB)
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "adaptive_rag"
    database_url: str | None = None

    # Authentication
    jwt_secret: str = "super-secret-adaptive-rag-jwt-token-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # Frontend
    frontend_url: str = "http://localhost:5173"

    # RAG / LLM
    llm_backend: str = "gemini"
    llm_model: str = "gemini-3.5-flash-lite"
    llm_api_key: str | None = None
    llm_api_base: str | None = None

    # Ollama
    ollama_url: str = "http://localhost:11434"

    # Models
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    cross_encoder_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # Storage
    faiss_storage_path: str = "./index_cache"
    upload_storage_path: str = "./data/uploads"

    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_url: str = "http://localhost:8000"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()