"""Test fixtures.

Every test gets its own SQLite file in pytest's temporary directory, copied from a
template database that was migrated once per session. Tests therefore never touch the
developer's real database (backend/data/devtrack.db) and cannot affect each other.
"""

import shutil
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.database import create_db_engine
from app.db_migrations import run_migrations
from app.main import create_app

# A Wednesday, so "this week" (Monday start) spans 2026-03-09 .. 2026-03-15.
FIXED_NOW = datetime(2026, 3, 11, 15, 0, tzinfo=UTC)


class Clock:
    """A controllable clock installed on app.state.clock."""

    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def set(self, value: datetime) -> None:
        self.now = value

    def advance(self, **kwargs: float) -> None:
        self.now += timedelta(**kwargs)


@pytest.fixture(scope="session")
def template_db(tmp_path_factory: pytest.TempPathFactory) -> Path:
    path = tmp_path_factory.mktemp("template") / "template.db"
    engine = create_db_engine(f"sqlite:///{path.as_posix()}")
    run_migrations(engine)
    engine.dispose()
    return path


@pytest.fixture
def db_path(template_db: Path, tmp_path: Path) -> Path:
    path = tmp_path / "devtrack-test.db"
    shutil.copyfile(template_db, path)
    return path


@pytest.fixture
def clock() -> Clock:
    return Clock(FIXED_NOW)


@pytest.fixture
def make_client(db_path: Path, clock: Clock) -> Callable[..., TestClient]:
    def _make(*, seed_demo_data: bool = False, raise_server_exceptions: bool = True) -> TestClient:
        settings = Settings(
            _env_file=None,  # ignore any developer .env file
            database_url=f"sqlite:///{db_path.as_posix()}",
            seed_demo_data=seed_demo_data,
            environment="test",
        )
        app = create_app(settings)
        app.state.clock = clock
        return TestClient(
            app,
            headers={"X-Timezone": "UTC"},
            raise_server_exceptions=raise_server_exceptions,
        )

    return _make


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> Iterator[TestClient]:
    with make_client() as test_client:
        yield test_client


class Api:
    """Small helpers that create records through the public API."""

    def __init__(self, client: TestClient) -> None:
        self.client = client

    def project(self, **overrides: Any) -> dict[str, Any]:
        payload = {"name": f"Project {uuid4().hex[:8]}", "status": "active", **overrides}
        response = self.client.post("/api/projects", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    def task(self, project_id: int, **overrides: Any) -> dict[str, Any]:
        payload = {"title": f"Task {uuid4().hex[:8]}", "project_id": project_id, **overrides}
        response = self.client.post("/api/tasks", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    def issue(self, project_id: int, **overrides: Any) -> dict[str, Any]:
        payload = {"title": f"Issue {uuid4().hex[:8]}", "project_id": project_id, **overrides}
        response = self.client.post("/api/issues", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    def patch_task(self, task_id: int, **changes: Any) -> dict[str, Any]:
        response = self.client.patch(f"/api/tasks/{task_id}", json=changes)
        assert response.status_code == 200, response.text
        return response.json()

    def activity(self, **params: Any) -> list[dict[str, Any]]:
        response = self.client.get("/api/activity", params=params)
        assert response.status_code == 200, response.text
        return response.json()["items"]


@pytest.fixture
def api(client: TestClient) -> Api:
    return Api(client)
