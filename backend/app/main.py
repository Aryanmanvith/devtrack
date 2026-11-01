"""FastAPI application factory.

Run the development server from the backend/ folder:

    python -m uvicorn app.main:app --reload --port 8000
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.bootstrap import initialize_workspace
from app.config import Settings, get_settings
from app.database import create_db_engine, create_session_factory
from app.db_migrations import run_migrations
from app.errors import register_exception_handlers
from app.routers import ALL_ROUTERS
from app.time_utils import utcnow

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

DESCRIPTION = """
REST API for **DevTrack**, a project and issue tracker for student software teams.

* Projects, tasks and issues with full CRUD, validation and consistent error responses.
* Dashboard and analytics endpoints whose numbers are calculated from stored records.
* Date-sensitive endpoints read the viewer's time zone from the `X-Timezone` header or `?tz=`.
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    engine = create_db_engine(settings.database_url)
    session_factory = create_session_factory(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        run_migrations(engine)
        with session_factory() as db:
            initialize_workspace(db, seed_demo_data=settings.seed_demo_data, now=app.state.clock())
        yield
        engine.dispose()

    app = FastAPI(
        title="DevTrack API",
        version=__version__,
        description=DESCRIPTION,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.clock = utcnow

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept", "X-Timezone"],
        allow_credentials=False,
    )
    register_exception_handlers(app)
    for router in ALL_ROUTERS:
        app.include_router(router)

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "name": "DevTrack API",
            "version": __version__,
            "docs": "/docs",
            "health": "/api/health",
        }

    return app


app = create_app()
