from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MyOwnRTXChat"
    api_prefix: str = ""
    ollama_base_url: str = "http://localhost:11434"
    database_url: str = f"sqlite:///{Path(__file__).resolve().parents[2].parent / 'database' / 'workspace.sqlite3'}"
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
