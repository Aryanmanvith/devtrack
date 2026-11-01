from datetime import date, datetime
from typing import Annotated

from pydantic import StringConstraints, ValidationInfo, field_validator

from app.enums import ProjectColor, ProjectStatus
from app.schemas.common import InputModel, ORMModel, reject_null

ProjectName = Annotated[str, StringConstraints(min_length=2, max_length=120)]
ProjectDescription = Annotated[str, StringConstraints(max_length=2000)]
OwnerName = Annotated[str, StringConstraints(max_length=80)]


def _blank_to_none(value: str | None) -> str | None:
    return value or None


class ProjectCreate(InputModel):
    name: ProjectName
    description: ProjectDescription = ""
    status: ProjectStatus = ProjectStatus.PLANNING
    color: ProjectColor = ProjectColor.INDIGO
    owner: OwnerName | None = None
    start_date: date | None = None
    due_date: date | None = None

    _owner = field_validator("owner")(_blank_to_none)

    @field_validator("due_date")
    @classmethod
    def deadline_not_before_start(cls, value: date | None, info: ValidationInfo) -> date | None:
        start = info.data.get("start_date")
        if value is not None and start is not None and value < start:
            raise ValueError("Deadline must be on or after the start date.")
        return value


class ProjectUpdate(InputModel):
    """Partial update: omitted fields are left unchanged; dates and owner may be cleared."""

    name: ProjectName | None = None
    description: ProjectDescription | None = None
    status: ProjectStatus | None = None
    color: ProjectColor | None = None
    owner: OwnerName | None = None
    start_date: date | None = None
    due_date: date | None = None

    _not_null = field_validator("name", "description", "status", "color", mode="before")(
        reject_null
    )
    _owner = field_validator("owner")(_blank_to_none)


class ProjectBrief(ORMModel):
    id: int
    name: str
    color: ProjectColor
    status: ProjectStatus
    is_demo: bool


class ProjectRead(ORMModel):
    id: int
    name: str
    description: str
    status: ProjectStatus
    color: ProjectColor
    owner: str | None
    start_date: date | None
    due_date: date | None
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    task_count: int = 0
    completed_task_count: int = 0
    open_task_count: int = 0
    overdue_task_count: int = 0
    open_issue_count: int = 0
    progress: int = 0
