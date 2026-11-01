"""Task use cases: filtered listing, CRUD, status lifecycle and Kanban ordering."""

from datetime import date, timedelta
from typing import Any, Literal

from sqlalchemy import ColumnElement, case, func, select
from sqlalchemy.orm import Session, contains_eager

from app.enums import (
    PRIORITY_LABELS,
    PRIORITY_RANK,
    TASK_STATUS_LABELS,
    EntityType,
    Priority,
    ProjectStatus,
    TaskStatus,
)
from app.errors import NotFoundError, ValidationFailed
from app.models import Project, Task, TaskLabel
from app.schemas.tasks import LabelCount, TaskCreate, TaskUpdate
from app.services.activity import change_details, join_words, record_activity
from app.services.common import contains, plain
from app.services.projects import require_open_project
from app.time_utils import TimeContext

TaskSort = Literal[
    "due_date", "priority", "created_at", "updated_at", "title", "position", "completed_at"
]
DueFilter = Literal["overdue", "today", "this_week", "upcoming", "no_date"]
SortOrder = Literal["asc", "desc"]

DEFAULT_ORDER: dict[str, SortOrder] = {
    "due_date": "asc",
    "priority": "desc",
    "created_at": "desc",
    "updated_at": "desc",
    "title": "asc",
    "position": "asc",
    "completed_at": "desc",
}
POSITION_STEP = 1024.0
FIELD_NAMES = {
    "title": "title",
    "description": "description",
    "priority": "priority",
    "due_date": "deadline",
    "labels": "labels",
    "project_id": "project",
}

priority_rank = case({p.value: rank for p, rank in PRIORITY_RANK.items()}, value=Task.priority)


def _conditions(
    ctx: TimeContext,
    *,
    q: str | None,
    statuses: list[TaskStatus] | None,
    priorities: list[Priority] | None,
    project_id: int | None,
    label: str | None,
    due: DueFilter | None,
    completed_from: date | None,
    completed_to: date | None,
    include_archived: bool,
) -> list[ColumnElement[bool]]:
    today = ctx.today
    _, week_end = ctx.week
    conditions: list[ColumnElement[bool]] = []
    if project_id is not None:
        conditions.append(Task.project_id == project_id)
    elif not include_archived:
        # Archived projects are hidden from boards, lists and metrics until restored.
        conditions.append(Project.status != ProjectStatus.ARCHIVED.value)
    if statuses:
        conditions.append(Task.status.in_([s.value for s in statuses]))
    if priorities:
        conditions.append(Task.priority.in_([p.value for p in priorities]))
    if q:
        conditions.append(contains(Task.title, q) | contains(Task.description, q))
    if label:
        conditions.append(Task.label_links.any(TaskLabel.name == label.strip().lower()))
    if due == "overdue":
        conditions += [Task.due_date < today, Task.status != TaskStatus.DONE.value]
    elif due == "today":
        conditions.append(Task.due_date == today)
    elif due == "this_week":
        conditions.append(Task.due_date.between(today, week_end))
    elif due == "upcoming":
        conditions.append(Task.due_date >= today)
    elif due == "no_date":
        conditions.append(Task.due_date.is_(None))
    if completed_from is not None:
        conditions.append(Task.completed_at >= ctx.day_start(completed_from))
    if completed_to is not None:
        conditions.append(Task.completed_at < ctx.day_start(completed_to + timedelta(days=1)))
    return conditions


def list_tasks(
    db: Session,
    ctx: TimeContext,
    *,
    q: str | None = None,
    statuses: list[TaskStatus] | None = None,
    priorities: list[Priority] | None = None,
    project_id: int | None = None,
    label: str | None = None,
    due: DueFilter | None = None,
    completed_from: date | None = None,
    completed_to: date | None = None,
    include_archived: bool = False,
    sort: TaskSort = "due_date",
    order: SortOrder | None = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[Task], int]:
    if completed_from and completed_to and completed_to < completed_from:
        raise ValidationFailed(
            "The completed range must end on or after its start.", field="completed_to"
        )
    conditions = _conditions(
        ctx,
        q=q,
        statuses=statuses,
        priorities=priorities,
        project_id=project_id,
        label=label,
        due=due,
        completed_from=completed_from,
        completed_to=completed_to,
        include_archived=include_archived,
    )
    total = (
        db.scalar(
            select(func.count(Task.id))
            .join(Project, Project.id == Task.project_id)
            .where(*conditions)
        )
        or 0
    )

    direction = order or DEFAULT_ORDER[sort]
    columns: dict[str, Any] = {
        "due_date": Task.due_date,
        "priority": priority_rank,
        "created_at": Task.created_at,
        "updated_at": Task.updated_at,
        "title": func.lower(Task.title),
        "position": Task.position,
        "completed_at": Task.completed_at,
    }
    column = columns[sort]
    ordering: list[Any] = []
    if sort in {"due_date", "completed_at"}:
        ordering.append(column.is_(None))  # empty values always sort last
    ordering.append(column.asc() if direction == "asc" else column.desc())
    if sort == "due_date":
        ordering.append(priority_rank.desc())
    ordering.append(Task.id.desc() if sort in {"created_at", "updated_at"} else Task.id.asc())

    stmt = (
        select(Task)
        .join(Task.project)
        .options(contains_eager(Task.project))
        .where(*conditions)
        .order_by(*ordering)
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt).all()), total


def get_task(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise NotFoundError(f"Task {task_id} was not found.")
    return task


def _next_position(db: Session, status: str, *, exclude_id: int | None = None) -> float:
    stmt = select(func.max(Task.position)).where(Task.status == status)
    if exclude_id is not None:
        stmt = stmt.where(Task.id != exclude_id)
    current = db.scalar(stmt)
    return (current or 0.0) + POSITION_STEP


def create_task(db: Session, data: TaskCreate, *, ctx: TimeContext) -> Task:
    project = require_open_project(db, data.project_id)
    status = plain(data.status)
    task = Task(
        project_id=project.id,
        title=data.title,
        description=data.description,
        status=status,
        priority=plain(data.priority),
        due_date=data.due_date,
        position=_next_position(db, status),
        created_at=ctx.now,
        updated_at=ctx.now,
        completed_at=ctx.now if status == TaskStatus.DONE else None,
    )
    task.label_links = [TaskLabel(name=name) for name in data.labels]
    db.add(task)
    db.flush()
    record_activity(
        db,
        now=ctx.now,
        event_type="task.created",
        entity_type=EntityType.TASK,
        entity_id=task.id,
        project_id=project.id,
        description=f'Created task "{task.title}" in {project.name}',
        details={"status": status, "priority": task.priority},
    )
    db.commit()
    return task


def _describe_update(
    task: Task, diff: dict[str, tuple[Any, Any]], new_project: Project | None
) -> str:
    if set(diff) == {"priority"}:
        old, new = diff["priority"]
        return (
            f'Changed priority of "{task.title}" from {PRIORITY_LABELS[Priority(old)]} '
            f"to {PRIORITY_LABELS[Priority(new)]}"
        )
    if set(diff) == {"project_id"} and new_project is not None:
        return f'Moved "{task.title}" to project {new_project.name}'
    return f'Updated {join_words(FIELD_NAMES[key] for key in diff)} of "{task.title}"'


def update_task(db: Session, task_id: int, data: TaskUpdate, *, ctx: TimeContext) -> Task:
    task = get_task(db, task_id)
    changes = {key: plain(value) for key, value in data.model_dump(exclude_unset=True).items()}
    position = changes.pop("position", None)
    labels = changes.pop("labels", None)
    new_status = changes.pop("status", None)

    new_project: Project | None = None
    if "project_id" in changes and changes["project_id"] != task.project_id:
        new_project = require_open_project(db, changes["project_id"])

    diff = {
        key: (getattr(task, key), value)
        for key, value in changes.items()
        if getattr(task, key) != value
    }
    if labels is not None and sorted(labels) != task.labels:
        diff["labels"] = (task.labels, sorted(labels))

    status_change: tuple[str, str] | None = None
    if new_status is not None and new_status != task.status:
        status_change = (task.status, new_status)

    position_changed = position is not None and position != task.position
    if not diff and status_change is None and not position_changed:
        return task

    for key, (_, value) in diff.items():
        if key == "labels":
            existing = {link.name: link for link in task.label_links}
            task.label_links = [existing.get(name) or TaskLabel(name=name) for name in value]
        else:
            setattr(task, key, value)

    if status_change is not None:
        old_status, target = status_change
        task.status = target
        if target == TaskStatus.DONE:
            task.completed_at = ctx.now
        elif old_status == TaskStatus.DONE:
            task.completed_at = None
        if position is None:
            position = _next_position(db, target, exclude_id=task.id)
            position_changed = True
    if position_changed and position is not None:
        task.position = position
    if diff or status_change is not None:
        task.updated_at = ctx.now

    if status_change is not None:
        old_status, target = status_change
        if target == TaskStatus.DONE:
            event, text = "task.completed", f'Completed "{task.title}"'
        else:
            event = "task.status_changed"
            text = (
                f'Moved "{task.title}" from {TASK_STATUS_LABELS[TaskStatus(old_status)]} '
                f"to {TASK_STATUS_LABELS[TaskStatus(target)]}"
            )
        record_activity(
            db,
            now=ctx.now,
            event_type=event,
            entity_type=EntityType.TASK,
            entity_id=task.id,
            project_id=task.project_id,
            description=text,
            details=change_details({"status": status_change}),
        )
    if diff:
        record_activity(
            db,
            now=ctx.now,
            event_type="task.updated",
            entity_type=EntityType.TASK,
            entity_id=task.id,
            project_id=task.project_id,
            description=_describe_update(task, diff, new_project),
            details=change_details(diff),
        )
    db.commit()
    if new_project is not None:
        db.refresh(task, attribute_names=["project"])
    return task


def delete_task(db: Session, task_id: int, *, ctx: TimeContext) -> None:
    task = get_task(db, task_id)
    record_activity(
        db,
        now=ctx.now,
        event_type="task.deleted",
        entity_type=EntityType.TASK,
        entity_id=task.id,
        project_id=task.project_id,
        description=f'Deleted task "{task.title}" from {task.project.name}',
    )
    db.delete(task)
    db.commit()


def list_labels(db: Session) -> list[LabelCount]:
    rows = db.execute(
        select(TaskLabel.name, func.count(TaskLabel.id))
        .join(Task, Task.id == TaskLabel.task_id)
        .join(Project, Project.id == Task.project_id)
        .where(Project.status != ProjectStatus.ARCHIVED.value)
        .group_by(TaskLabel.name)
        .order_by(func.count(TaskLabel.id).desc(), TaskLabel.name)
    ).all()
    return [LabelCount(name=name, count=count) for name, count in rows]
