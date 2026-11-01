from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints, field_validator

from app.enums import Priority, TaskStatus
from app.schemas.common import InputModel, ORMModel, reject_null
from app.schemas.projects import ProjectBrief

TaskTitle = Annotated[str, StringConstraints(min_length=1, max_length=200)]
TaskDescription = Annotated[str, StringConstraints(max_length=5000)]


def _normalise_label(value: object) -> object:
    # Runs before the pattern check, which pydantic applies before its own to_lower step.
    return value.strip().lower() if isinstance(value, str) else value


LabelName = Annotated[
    str,
    BeforeValidator(_normalise_label),
    StringConstraints(min_length=1, max_length=24, pattern=r"^[a-z0-9][a-z0-9-]*$"),
]
MAX_LABELS = 6


def _dedupe(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    return list(dict.fromkeys(values))


class TaskCreate(InputModel):
    title: TaskTitle
    description: TaskDescription = ""
    project_id: int = Field(gt=0)
    status: TaskStatus = TaskStatus.TODO
    priority: Priority = Priority.MEDIUM
    due_date: date | None = None
    labels: list[LabelName] = Field(default_factory=list, max_length=MAX_LABELS)

    _labels = field_validator("labels")(_dedupe)


class TaskUpdate(InputModel):
    """Partial update. Sending ``position`` without ``status`` reorders inside a column."""

    title: TaskTitle | None = None
    description: TaskDescription | None = None
    project_id: int | None = Field(default=None, gt=0)
    status: TaskStatus | None = None
    priority: Priority | None = None
    due_date: date | None = None
    labels: list[LabelName] | None = Field(default=None, max_length=MAX_LABELS)
    position: float | None = Field(default=None, allow_inf_nan=False)

    _not_null = field_validator(
        "title",
        "description",
        "project_id",
        "status",
        "priority",
        "labels",
        "position",
        mode="before",
    )(reject_null)
    _labels = field_validator("labels")(_dedupe)


class TaskRead(ORMModel):
    id: int
    project_id: int
    project: ProjectBrief
    title: str
    description: str
    status: TaskStatus
    priority: Priority
    due_date: date | None
    position: float
    labels: list[str]
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class LabelCount(BaseModel):
    name: str
    count: int
