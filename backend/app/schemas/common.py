"""Shared schema building blocks."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    """Response model that can be built from SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)


class InputModel(BaseModel):
    """Request body model: unknown fields are rejected and strings are trimmed."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def reject_null(value: Any) -> Any:
    """Use as a mode="before" validator for PATCH fields that are optional but not nullable."""
    if value is None:
        raise ValueError("This field cannot be null.")
    return value


class Page[T](BaseModel):
    items: list[T]
    total: int = Field(description="Number of records matching the filters (ignores paging).")
    limit: int
    offset: int


class CountItem(BaseModel):
    key: str
    count: int


class FieldError(BaseModel):
    field: str | None
    message: str


class ErrorResponse(BaseModel):
    detail: str
    code: str
    errors: list[FieldError] = Field(default_factory=list)
