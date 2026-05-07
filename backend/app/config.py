from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LLLMao"
    api_prefix: str = ""
    ollama_base_url: str = "http://localhost:11434"
    backend_root: Path = Path(__file__).resolve().parents[1]
    database_url: str = f"sqlite:///{backend_root / 'database' / 'workspace.sqlite3'}"
    upload_path: str = str(backend_root / "uploads")
    image_path: str = str(backend_root / "images")
    chroma_path: str = str(backend_root / "database" / "chroma")
    rag_embedding_model: str = "nomic-embed-text"
    rag_retrieval_limit: int = 5
    context_token_budget: int = 3200
    cors_origins: list[str] = [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(env_file=".env", env_prefix="MYOWNRTXCHAT_")


@lru_cache
def get_settings() -> Settings:
    return Settings()
