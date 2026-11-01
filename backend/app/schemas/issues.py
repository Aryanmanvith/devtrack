from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.enums import IssueStatus, IssueType, Priority
from app.schemas.common import CountItem, InputModel, ORMModel, reject_null
from app.schemas.projects import ProjectBrief

IssueTitle = Annotated[str, StringConstraints(min_length=1, max_length=200)]
IssueDescription = Annotated[str, StringConstraints(max_length=5000)]


class IssueCreate(InputModel):
    title: IssueTitle
    description: IssueDescription = ""
    project_id: int = Field(gt=0)
    type: IssueType = IssueType.BUG
    priority: Priority = Priority.MEDIUM
    status: IssueStatus = IssueStatus.OPEN


class IssueUpdate(InputModel):
    title: IssueTitle | None = None
    description: IssueDescription | None = None
    project_id: int | None = Field(default=None, gt=0)
    type: IssueType | None = None
    priority: Priority | None = None
    status: IssueStatus | None = None

    _not_null = field_validator(
        "title", "description", "project_id", "type", "priority", "status", mode="before"
    )(reject_null)


class IssueRead(ORMModel):
    id: int
    project_id: int
    project: ProjectBrief
    title: str
    description: str
    type: IssueType
    priority: Priority
    status: IssueStatus
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class IssueSummary(BaseModel):
    total: int
    open: int = Field(description="Issues that are Open or In Progress.")
    closed: int = Field(description="Issues that are Resolved or Closed.")
    by_status: list[CountItem]
    by_type: list[CountItem]
