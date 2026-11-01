"""Health check, workspace preferences and demo data management."""

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import text

from app import __version__
from app.deps import Ctx, DbSession, Now
from app.schemas.common import ErrorResponse
from app.schemas.insights import (
    DemoRemoval,
    DemoStatus,
    HealthStatus,
    PreferencesRead,
    PreferencesUpdate,
)
from app.services import demo
from app.services.misc import get_preferences, update_preferences
from app.time_utils import utcnow

router = APIRouter()


@router.get(
    "/api/health",
    response_model=HealthStatus,
    tags=["system"],
    responses={503: {"model": HealthStatus, "description": "Database unreachable"}},
)
def health(request: Request, response: Response) -> HealthStatus:
    database_ok = True
    try:
        with request.app.state.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database_ok = False
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthStatus(
        status="ok" if database_ok else "degraded",
        database="ok" if database_ok else "unavailable",
        version=__version__,
        time=utcnow(),
    )


@router.get("/api/preferences", response_model=PreferencesRead, tags=["preferences"])
def read_preferences(db: DbSession) -> PreferencesRead:
    return PreferencesRead.model_validate(get_preferences(db))


@router.patch("/api/preferences", response_model=PreferencesRead, tags=["preferences"])
def patch_preferences(data: PreferencesUpdate, db: DbSession, now: Now) -> PreferencesRead:
    return PreferencesRead.model_validate(update_preferences(db, data, now=now))


@router.get("/api/demo-data", response_model=DemoStatus, tags=["demo data"])
def demo_data_status(db: DbSession) -> DemoStatus:
    return demo.demo_status(db)


@router.post(
    "/api/demo-data",
    response_model=DemoStatus,
    status_code=status.HTTP_201_CREATED,
    tags=["demo data"],
    responses={409: {"model": ErrorResponse, "description": "Demo data already loaded"}},
)
def load_demo_data(db: DbSession, ctx: Ctx) -> DemoStatus:
    return demo.seed_demo(db, ctx)


@router.delete("/api/demo-data", response_model=DemoRemoval, tags=["demo data"])
def remove_demo_data(db: DbSession, now: Now) -> DemoRemoval:
    return demo.remove_demo(db, now=now)
