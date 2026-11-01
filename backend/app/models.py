"""SQLAlchemy ORM models.

Design notes
------------
* Progress is never stored: it is calculated from a project's tasks on every read.
* Deleting a project cascades to its tasks, task labels and issues at the database level
  (ON DELETE CASCADE, enforced because SQLite foreign keys are switched on per connection).
* Activity rows are an audit log. They keep a plain ``entity_id`` so history survives
  deletions, while ``project_id`` is set to NULL when the project disappears.
* Check constraints keep lifecycle timestamps consistent with status values.
"""

from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
    func,
)
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import (
    EntityType,
    IssueStatus,
    IssueType,
    Priority,
    ProjectColor,
    ProjectStatus,
    TaskStatus,
    Theme,
    WeekStart,
)
from app.time_utils import utcnow


class UTCDateTime(TypeDecorator[datetime]):
    """Store timezone-aware datetimes as naive UTC and return them as aware UTC values."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetimes are not allowed; pass a timezone-aware value.")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC)


def _one_of(values: type[StrEnum]) -> str:
    return ", ".join(f"'{member.value}'" for member in values)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(
        String(20), default=ProjectStatus.PLANNING.value, index=True
    )
    color: Mapped[str] = mapped_column(String(20), default=ProjectColor.INDIGO.value)
    owner: Mapped[str | None] = mapped_column(String(80))
    start_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    tasks: Mapped[list["Task"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )
    issues: Mapped[list["Issue"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        CheckConstraint(f"status IN ({_one_of(ProjectStatus)})", name="status"),
        CheckConstraint(f"color IN ({_one_of(ProjectColor)})", name="color"),
        CheckConstraint(
            "start_date IS NULL OR due_date IS NULL OR due_date >= start_date",
            name="date_order",
        ),
    )


# Project names are unique regardless of letter case.
Index("uq_projects_name_lower", func.lower(Project.name), unique=True)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=TaskStatus.TODO.value)
    priority: Mapped[str] = mapped_column(String(10), default=Priority.MEDIUM.value)
    due_date: Mapped[date | None] = mapped_column(Date, index=True)
    # Ordering inside a Kanban column (fractional, so a move only rewrites one row).
    position: Mapped[float] = mapped_column(Float, default=0.0)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, index=True)

    project: Mapped[Project] = relationship(back_populates="tasks")
    label_links: Mapped[list["TaskLabel"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(f"status IN ({_one_of(TaskStatus)})", name="status"),
        CheckConstraint(f"priority IN ({_one_of(Priority)})", name="priority"),
        CheckConstraint(
            "(status = 'done') = (completed_at IS NOT NULL)", name="completed_at_matches_status"
        ),
        Index("ix_tasks_status_position", "status", "position"),
    )

    @property
    def labels(self) -> list[str]:
        return sorted(link.name for link in self.label_links)


class TaskLabel(Base):
    __tablename__ = "task_labels"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(24), index=True)

    task: Mapped[Task] = relationship(back_populates="label_links")

    __table_args__ = (UniqueConstraint("task_id", "name", name="uq_task_labels_task_id_name"),)


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    type: Mapped[str] = mapped_column(String(20), default=IssueType.BUG.value)
    priority: Mapped[str] = mapped_column(String(10), default=Priority.MEDIUM.value)
    status: Mapped[str] = mapped_column(String(20), default=IssueStatus.OPEN.value, index=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    project: Mapped[Project] = relationship(back_populates="issues")

    __table_args__ = (
        CheckConstraint(f"type IN ({_one_of(IssueType)})", name="type"),
        CheckConstraint(f"priority IN ({_one_of(Priority)})", name="priority"),
        CheckConstraint(f"status IN ({_one_of(IssueStatus)})", name="status"),
        CheckConstraint(
            "(status IN ('resolved', 'closed')) = (resolved_at IS NOT NULL)",
            name="resolved_at_matches_status",
        ),
    )


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_type: Mapped[str] = mapped_column(String(20))
    entity_id: Mapped[int | None] = mapped_column()
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    description: Mapped[str] = mapped_column(String(500))
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    __table_args__ = (
        CheckConstraint(f"entity_type IN ({_one_of(EntityType)})", name="entity_type"),
        Index("ix_activities_entity", "entity_type", "entity_id"),
    )


class UserPreferences(Base):
    """Single-row table holding local workspace preferences (there are no user accounts)."""

    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    display_name: Mapped[str] = mapped_column(String(60), default="Student")
    theme: Mapped[str] = mapped_column(String(10), default=Theme.DARK.value)
    week_start: Mapped[str] = mapped_column(String(10), default=WeekStart.MONDAY.value)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint(f"theme IN ({_one_of(Theme)})", name="theme"),
        CheckConstraint(f"week_start IN ({_one_of(WeekStart)})", name="week_start"),
    )
