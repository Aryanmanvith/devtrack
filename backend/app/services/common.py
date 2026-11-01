"""Small query helpers shared by the services."""

from datetime import date, datetime
from enum import Enum
from typing import Any

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session


def escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def contains(column: Any, term: str) -> ColumnElement[bool]:
    """Case-insensitive substring match with LIKE wildcards in user input escaped."""
    return column.ilike(f"%{escape_like(term)}%", escape="\\")


def count_rows(db: Session, stmt: Select[Any]) -> int:
    subquery = stmt.order_by(None).subquery()
    return db.scalar(select(func.count()).select_from(subquery)) or 0


def plain(value: Any) -> Any:
    """Convert enums to their stored string value before assigning them to ORM columns."""
    return value.value if isinstance(value, Enum) else value


def jsonable(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, date | datetime):
        return value.isoformat()
    if isinstance(value, list | tuple):
        return [jsonable(item) for item in value]
    return value
