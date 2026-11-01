"""Domain exceptions and a consistent JSON error format.

Every error response has the same shape::

    {
        "detail": "Human readable summary",
        "code": "machine_code",
        "errors": [{"field": "title", "message": "This field cannot be empty."}],
    }

``detail`` is always a string so the frontend can show it in a toast, and ``errors`` lets
forms highlight individual fields. Stack traces and internal details are never returned.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("devtrack")

FIELD_LABELS = {
    "name": "Name",
    "title": "Title",
    "description": "Description",
    "status": "Status",
    "priority": "Priority",
    "type": "Type",
    "color": "Color",
    "owner": "Owner",
    "start_date": "Start date",
    "due_date": "Deadline",
    "project_id": "Project",
    "labels": "Labels",
    "position": "Position",
    "display_name": "Display name",
    "theme": "Theme",
    "week_start": "Week start",
    "tz": "Time zone",
}


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, field: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.field = field


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_error"


def error_body(
    detail: str, code: str, errors: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    return {"detail": detail, "code": code, "errors": errors or []}


def _field_from_loc(loc: tuple[Any, ...]) -> str | None:
    # loc looks like ("body", "title"), ("query", "status", 0) or ("body",).
    parts = [part for part in loc[1:] if isinstance(part, str)]
    return parts[0] if parts else None


def _friendly_message(error: dict[str, Any]) -> str:
    kind = error.get("type", "")
    ctx = error.get("ctx") or {}
    if kind == "missing":
        return "This field is required."
    if kind == "string_too_short":
        minimum = ctx.get("min_length", 1)
        if minimum <= 1:
            return "This field cannot be empty."
        return f"Must be at least {minimum} characters."
    if kind == "string_too_long":
        return f"Must be at most {ctx.get('max_length')} characters."
    if kind in {"too_long", "list_too_long"}:
        return f"No more than {ctx.get('max_length')} items are allowed."
    if kind.startswith("date"):
        return "Enter a valid date in YYYY-MM-DD format."
    if kind in {"int_parsing", "int_type", "int_from_float"}:
        return "Must be a whole number."
    if kind == "greater_than":
        return f"Must be greater than {ctx.get('gt')}."
    if kind == "extra_forbidden":
        return "This field is not recognised."
    if kind == "json_invalid":
        return "The request body is not valid JSON."
    if kind == "string_pattern_mismatch":
        return "Use lowercase letters, numbers and hyphens only."
    message = str(error.get("msg", "Invalid value."))
    return message.removeprefix("Value error, ")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        errors = [{"field": exc.field, "message": exc.message}] if exc.field else []
        return JSONResponse(
            status_code=exc.status_code, content=error_body(exc.message, exc.code, errors)
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {"field": _field_from_loc(tuple(err.get("loc", ()))), "message": _friendly_message(err)}
            for err in exc.errors()
        ]
        first = errors[0] if errors else {"field": None, "message": "Invalid request."}
        label = FIELD_LABELS.get(first["field"] or "", first["field"] or "")
        detail = f"{label}: {first['message']}" if label else first["message"]
        if len(errors) > 1:
            detail += f" ({len(errors) - 1} more field{'s' if len(errors) > 2 else ''} to fix)"
        return JSONResponse(status_code=422, content=error_body(detail, "validation_error", errors))

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
        if exc.status_code == 404 and detail == "Not Found":
            detail = "The requested endpoint does not exist."
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(detail, f"http_{exc.status_code}"),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(IntegrityError)
    async def handle_integrity_error(_request: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning("Integrity error: %s", exc.orig)
        return JSONResponse(
            status_code=409,
            content=error_body(
                "The change conflicts with existing data. Refresh and try again.", "conflict"
            ),
        )

    @app.exception_handler(SQLAlchemyError)
    async def handle_database_error(_request: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.exception("Database error", exc_info=exc)
        return JSONResponse(
            status_code=503,
            content=error_body(
                "The database is unavailable. Check the backend logs.", "database_error"
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content=error_body(
                "Unexpected server error. Check the backend logs.", "internal_error"
            ),
        )
