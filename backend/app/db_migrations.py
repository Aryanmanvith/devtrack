"""Run Alembic migrations programmatically (used at startup, by the CLI and by tests)."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.engine import Engine

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", MIGRATIONS_DIR.as_posix())
    config.set_main_option("path_separator", "os")
    return config


def run_migrations(engine: Engine) -> None:
    """Upgrade the database behind ``engine`` to the latest schema revision."""
    config = alembic_config()
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
