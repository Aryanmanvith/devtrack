"""Application settings loaded from environment variables and optional .env files."""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime configuration. Every field can be set with a DEVTRACK_* environment variable."""

    model_config = SettingsConfigDict(
        env_prefix="DEVTRACK_",
        # The repository-root .env is shared with the frontend; backend/.env may override it.
        env_file=(REPO_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    database_url: str = "sqlite:///./data/devtrack.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_demo_data: bool = True

    @field_validator("database_url")
    @classmethod
    def resolve_relative_sqlite_path(cls, value: str) -> str:
        """Resolve relative SQLite paths against backend/ so the working directory never matters."""
        url = make_url(value)
        database = url.database
        if url.get_backend_name() != "sqlite" or not database or database == ":memory:":
            return value
        path = Path(database)
        if not path.is_absolute():
            path = (BACKEND_DIR / path).resolve()
        return f"sqlite:///{path.as_posix()}"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
