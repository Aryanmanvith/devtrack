"""Schemas for the dashboard, analytics, activity, search, preferences and demo endpoints."""

from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.enums import IssueStatus, IssueType, Priority, TaskStatus, Theme, WeekStart
from app.schemas.common import CountItem, InputModel, ORMModel, reject_null
from app.schemas.projects import ProjectBrief
from app.schemas.tasks import TaskRead

# ---- Health -------------------------------------------------------------------------------


class HealthStatus(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]
    version: str
    time: datetime


# ---- Dashboard ----------------------------------------------------------------------------


class DashboardSummary(BaseModel):
    today: date
    week_start: date
    week_end: date
    timezone: str
    active_projects: int = Field(description="Projects whose status is Active.")
    open_projects: int = Field(description="Projects that are Planning, Active or On Hold.")
    total_projects: int = Field(description="All projects except archived ones.")
    total_tasks: int
    open_tasks: int = Field(description="Tasks not yet Done, excluding archived projects.")
    in_progress_tasks: int
    completed_this_week: int = Field(description="Tasks completed between week_start and now.")
    completed_last_week: int
    overdue_tasks: int = Field(description="Tasks not Done whose deadline is before today.")
    due_today: int
    due_this_week: int = Field(description="Tasks not Done due between today and week_end.")
    open_issues: int


class TrendPoint(BaseModel):
    week_start: date
    week_end: date
    completed: int = Field(description="Tasks completed during the week.")
    created: int = Field(description="Tasks created during the week.")
    remaining: int = Field(description="Tasks still open at the end of the week (or now).")


class CompletionTrend(BaseModel):
    weeks: int
    today: date
    points: list[TrendPoint]


class TaskDistribution(BaseModel):
    total: int
    open_total: int
    by_status: list[CountItem] = Field(description="All tasks grouped by status.")
    by_priority: list[CountItem] = Field(description="Open tasks grouped by priority.")


class DeadlineItem(TaskRead):
    days_until: int = Field(description="Days from today until the deadline; negative if late.")
    is_overdue: bool


class UpcomingDeadlines(BaseModel):
    today: date
    days: int
    overdue_count: int
    upcoming_count: int
    items: list[DeadlineItem]


# ---- Analytics ----------------------------------------------------------------------------


class ProjectProgressItem(BaseModel):
    project: ProjectBrief
    total: int
    done: int
    open: int
    progress: int


class IssueTypeItem(BaseModel):
    type: IssueType
    open: int
    closed: int


class DailyCount(BaseModel):
    date: date
    count: int


class AnalyticsOverview(BaseModel):
    today: date
    weeks: int
    range_start: date
    range_end: date
    project_id: int | None
    total_tasks: int
    completed_tasks: int
    open_tasks: int
    overdue_tasks: int
    completion_rate: float = Field(description="Done tasks as a percentage of all tasks (0-100).")
    completed_in_range: int
    created_in_range: int
    avg_cycle_days: float | None = Field(
        description="Average days from creation to completion for tasks completed in range."
    )
    open_issues: int
    resolved_issues_in_range: int
    by_status: list[CountItem]
    by_priority: list[CountItem]
    weekly: list[TrendPoint]
    daily_completions: list[DailyCount]
    project_progress: list[ProjectProgressItem]
    issues_by_type: list[IssueTypeItem]


# ---- Activity -----------------------------------------------------------------------------


class ActivityRead(ORMModel):
    id: int
    event_type: str
    entity_type: str
    entity_id: int | None
    project_id: int | None
    project: ProjectBrief | None
    description: str
    details: dict[str, Any] | None
    created_at: datetime
    entity_exists: bool | None = Field(
        description=(
            "Whether the referenced project, task or issue still exists (null for system events)."
        )
    )


# ---- Search -------------------------------------------------------------------------------


class TaskSearchHit(ORMModel):
    id: int
    title: str
    status: TaskStatus
    priority: Priority
    project: ProjectBrief


class IssueSearchHit(ORMModel):
    id: int
    title: str
    status: IssueStatus
    type: IssueType
    project: ProjectBrief


class SearchResults(BaseModel):
    query: str
    projects: list[ProjectBrief]
    tasks: list[TaskSearchHit]
    issues: list[IssueSearchHit]


# ---- Preferences --------------------------------------------------------------------------

DisplayName = Annotated[str, StringConstraints(min_length=1, max_length=60)]


class PreferencesRead(ORMModel):
    display_name: str
    theme: Theme
    week_start: WeekStart
    updated_at: datetime


class PreferencesUpdate(InputModel):
    display_name: DisplayName | None = None
    theme: Theme | None = None
    week_start: WeekStart | None = None

    _not_null = field_validator("display_name", "theme", "week_start", mode="before")(reject_null)


# ---- Demo data ----------------------------------------------------------------------------


class DemoStatus(BaseModel):
    has_demo_data: bool
    projects: int
    tasks: int
    issues: int
    user_tasks_in_demo_projects: int = Field(
        description="Tasks you created inside demo projects; removing demo data deletes them too."
    )
    user_issues_in_demo_projects: int


class DemoRemoval(BaseModel):
    removed_projects: int
    removed_tasks: int
    removed_issues: int
