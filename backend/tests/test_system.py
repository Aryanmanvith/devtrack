"""Health check, error format, persistence, migrations and database integrity."""

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from fastapi import APIRouter
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

from app.database import Base, create_db_engine
from app.db_migrations import alembic_config


def test_health_reports_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["version"]


def test_health_reports_unreachable_database(client, tmp_path):
    good_engine = client.app.state.engine
    # Point the health check at a database file whose parent directory is actually a file.
    blocker = tmp_path / "not-a-directory"
    blocker.write_text("x")
    client.app.state.engine = create_engine(f"sqlite:///{(blocker / 'x.db').as_posix()}")
    try:
        response = client.get("/api/health")
    finally:
        client.app.state.engine.dispose()
        client.app.state.engine = good_engine
    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"


def test_openapi_documentation_is_available(client):
    schema = client.get("/openapi.json").json()
    assert "/api/projects" in schema["paths"]
    assert "/api/tasks/{task_id}" in schema["paths"]
    assert client.get("/docs").status_code == 200


def test_unknown_endpoint_uses_consistent_error_format(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json() == {
        "detail": "The requested endpoint does not exist.",
        "code": "http_404",
        "errors": [],
    }


def test_malformed_json_returns_validation_error(client):
    response = client.post(
        "/api/projects", content="{not json", headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_unexpected_errors_hide_internals(make_client):
    with make_client(raise_server_exceptions=False) as client:
        router = APIRouter()

        @router.get("/api/boom")
        def boom():
            raise RuntimeError("secret internal detail")

        client.app.include_router(router)
        response = client.get("/api/boom")
    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "internal_error"
    assert "secret" not in response.text
    assert "Traceback" not in response.text


def test_cors_allows_only_the_configured_frontend_origin(client):
    allowed = client.options(
        "/api/projects",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    denied = client.options(
        "/api/projects",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in denied.headers


def test_data_persists_after_backend_restart(make_client):
    with make_client() as first:
        project = first.post("/api/projects", json={"name": "Survives restarts"}).json()
        first.post("/api/tasks", json={"title": "Keep me", "project_id": project["id"]})
    with make_client() as second:
        fetched = second.get(f"/api/projects/{project['id']}")
        assert fetched.status_code == 200
        assert fetched.json()["name"] == "Survives restarts"
        assert fetched.json()["task_count"] == 1


# SQLite cannot reflect expression indexes, so autogenerate skips uq_projects_name_lower;
# the next test checks that index directly.
@pytest.mark.filterwarnings("ignore:Skipped unsupported reflection of expression-based index")
@pytest.mark.filterwarnings(
    "ignore:autogenerate skipping metadata-specified expression-based index"
)
def test_migrations_match_the_models(template_db):
    engine = create_db_engine(f"sqlite:///{template_db.as_posix()}")
    with engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        differences = compare_metadata(context, Base.metadata)
    engine.dispose()
    assert differences == []


def test_case_insensitive_name_index_is_enforced_by_the_database(client):
    engine = client.app.state.engine
    with engine.connect() as connection:
        sql = connection.execute(
            text(
                "SELECT sql FROM sqlite_master"
                " WHERE type = 'index' AND name = 'uq_projects_name_lower'"
            )
        ).scalar()
        assert sql is not None and "lower(name)" in sql
        insert = text(
            "INSERT INTO projects"
            " (name, description, status, color, is_demo, created_at, updated_at) VALUES"
            " (:name, '', 'active', 'indigo', 0, '2026-01-01', '2026-01-01')"
        )
        connection.execute(insert, {"name": "Unique Name"})
        with pytest.raises(IntegrityError):
            connection.execute(insert, {"name": "UNIQUE name"})
        connection.rollback()


def test_downgrade_and_upgrade_round_trip(db_path):
    engine = create_db_engine(f"sqlite:///{db_path.as_posix()}")
    config = alembic_config()
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "base")
    assert "projects" not in inspect(engine).get_table_names()
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
    assert {"projects", "tasks", "issues", "activities"} <= set(inspect(engine).get_table_names())
    engine.dispose()


def test_foreign_keys_are_enforced_by_sqlite(client):
    engine = client.app.state.engine
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA foreign_keys")).scalar() == 1
        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    "INSERT INTO tasks (project_id, title, description, status, priority, position,"
                    " is_demo, created_at, updated_at) VALUES (9999, 't', '', 'todo', 'low', 0, 0,"
                    " '2026-01-01', '2026-01-01')"
                )
            )
        connection.rollback()


def test_check_constraint_keeps_completed_at_consistent(client, api):
    project = api.project()
    engine = client.app.state.engine
    with engine.connect() as connection:
        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    "INSERT INTO tasks (project_id, title, description, status, priority, position,"
                    " is_demo, created_at, updated_at) VALUES (:pid, 't', '', 'done', 'low', 0, 0,"
                    " '2026-01-01', '2026-01-01')"
                ),
                {"pid": project["id"]},
            )
        connection.rollback()
