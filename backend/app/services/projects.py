"""Project use cases: listing with calculated progress, CRUD, archiving and safe deletion."""

from datetime import date, datetime
from typing import Any, Literal

from sqlalchemy import Select, and_, case, func, literal, or_, select
from sqlalchemy.orm import Session

from app.enums import (
    OPEN_ISSUE_STATUSES,
    PROJECT_STATUS_LABELS,
    EntityType,
    ProjectStatus,
    TaskStatus,
)
from app.errors import ConflictError, NotFoundError, ValidationFailed
from app.models import Issue, Project, Task
from app.schemas.projects import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.activity import change_details, join_words, record_activity
from app.services.common import contains, count_rows, plain

ProjectSort = Literal["updated_at", "created_at", "name", "due_date", "progress", "status"]
SortOrder = Literal["asc", "desc"]

DEFAULT_ORDER: dict[str, SortOrder] = {
    "updated_at": "desc",
    "created_at": "desc",
    "name": "asc",
    "due_date": "asc",
    "progress": "desc",
    "status": "asc",
}

FIELD_NAMES = {
    "name": "name",
    "description": "description",
    "color": "color",
    "owner": "owner",
    "start_date": "start date",
    "due_date": "deadline",
}


def _stats_query(today: date) -> tuple[Select[Any], Any]:
    """Select projects together with task/issue aggregates in a single round trip."""
    is_done = Task.status == TaskStatus.DONE.value
    task_stats = (
        select(
            Task.project_id.label("project_id"),
            func.count(Task.id).label("task_count"),
            func.sum(case((is_done, 1), else_=0)).label("done_count"),
            func.sum(case((and_(~is_done, Task.due_date < today), 1), else_=0)).label(
                "overdue_count"
            ),
        )
        .group_by(Task.project_id)
        .subquery()
    )
    issue_stats = (
        select(Issue.project_id.label("project_id"), func.count(Issue.id).label("open_issues"))
        .where(Issue.status.in_([s.value for s in OPEN_ISSUE_STATUSES]))
        .group_by(Issue.project_id)
        .subquery()
    )
    task_count = func.coalesce(task_stats.c.task_count, 0)
    done_count = func.coalesce(task_stats.c.done_count, 0)
    progress = case((task_count > 0, done_count * literal(100.0) / task_count), else_=0.0)
    stmt = (
        select(
            Project,
            task_count.label("task_count"),
            done_count.label("done_count"),
            func.coalesce(task_stats.c.overdue_count, 0).label("overdue_count"),
            func.coalesce(issue_stats.c.open_issues, 0).label("open_issues"),
        )
        .outerjoin(task_stats, task_stats.c.project_id == Project.id)
        .outerjoin(issue_stats, issue_stats.c.project_id == Project.id)
    )
    return stmt, progress


def _to_read(row: Any) -> ProjectRead:
    project, task_count, done_count, overdue_count, open_issues = row
    task_count, done_count = int(task_count), int(done_count)
    # Floor division: a project only shows 100% once every task is done.
    progress = (done_count * 100) // task_count if task_count else 0
    return ProjectRead.model_validate(project).model_copy(
        update={
            "task_count": task_count,
            "completed_task_count": done_count,
            "open_task_count": task_count - done_count,
            "overdue_task_count": int(overdue_count),
            "open_issue_count": int(open_issues),
            "progress": progress,
        }
    )


def list_projects(
    db: Session,
    *,
    today: date,
    q: str | None = None,
    statuses: list[ProjectStatus] | None = None,
    include_archived: bool = False,
    sort: ProjectSort = "updated_at",
    order: SortOrder | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[ProjectRead], int]:
    stmt, progress = _stats_query(today)
    if statuses:
        stmt = stmt.where(Project.status.in_([s.value for s in statuses]))
    elif not include_archived:
        stmt = stmt.where(Project.status != ProjectStatus.ARCHIVED.value)
    if q:
        stmt = stmt.where(
            or_(
                contains(Project.name, q),
                contains(Project.description, q),
                contains(Project.owner, q),
            )
        )
    total = count_rows(db, stmt)

    direction = order or DEFAULT_ORDER[sort]
    status_rank = case(
        {status.value: index for index, status in enumerate(ProjectStatus)}, value=Project.status
    )
    columns = {
        "updated_at": Project.updated_at,
        "created_at": Project.created_at,
        "name": func.lower(Project.name),
        "due_date": Project.due_date,
        "progress": progress,
        "status": status_rank,
    }
    column = columns[sort]
    ordering = [column.asc() if direction == "asc" else column.desc()]
    if sort == "due_date":
        ordering.insert(0, Project.due_date.is_(None))  # projects without a deadline go last
    stmt = stmt.order_by(*ordering, Project.id).limit(limit).offset(offset)
    return [_to_read(row) for row in db.execute(stmt).all()], total


def get_project_model(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise NotFoundError(f"Project {project_id} was not found.")
    return project


def get_project(db: Session, project_id: int, *, today: date) -> ProjectRead:
    stmt, _ = _stats_query(today)
    row = db.execute(stmt.where(Project.id == project_id)).first()
    if row is None:
        raise NotFoundError(f"Project {project_id} was not found.")
    return _to_read(row)


def _ensure_unique_name(db: Session, name: str, *, exclude_id: int | None = None) -> None:
    stmt = select(Project.id).where(func.lower(Project.name) == func.lower(literal(name)))
    if exclude_id is not None:
        stmt = stmt.where(Project.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise ConflictError(f'A project named "{name}" already exists.', field="name")


def create_project(db: Session, data: ProjectCreate, *, now: datetime) -> Project:
    _ensure_unique_name(db, data.name)
    values = {key: plain(value) for key, value in data.model_dump().items()}
    project = Project(**values, created_at=now, updated_at=now)
    db.add(project)
    db.flush()
    record_activity(
        db,
        now=now,
        event_type="project.created",
        entity_type=EntityType.PROJECT,
        entity_id=project.id,
        project_id=project.id,
        description=f'Created project "{project.name}"',
    )
    db.commit()
    return project


def update_project(db: Session, project_id: int, data: ProjectUpdate, *, now: datetime) -> Project:
    project = get_project_model(db, project_id)
    changes = {key: plain(value) for key, value in data.model_dump(exclude_unset=True).items()}

    if "name" in changes and changes["name"] != project.name:
        _ensure_unique_name(db, changes["name"], exclude_id=project.id)
    start = changes.get("start_date", project.start_date)
    due = changes.get("due_date", project.due_date)
    if start is not None and due is not None and due < start:
        raise ValidationFailed("Deadline must be on or after the start date.", field="due_date")

    diff = {
        key: (getattr(project, key), value)
        for key, value in changes.items()
        if getattr(project, key) != value
    }
    if not diff:
        return project

    old_name = project.name
    for key, (_, value) in diff.items():
        setattr(project, key, value)
    project.updated_at = now

    status_change = diff.pop("status", None)
    if status_change is not None:
        old_status, new_status = status_change
        if new_status == ProjectStatus.ARCHIVED:
            event, text = "project.archived", f'Archived project "{project.name}"'
        elif old_status == ProjectStatus.ARCHIVED:
            event, text = "project.restored", f'Restored project "{project.name}"'
        else:
            event = "project.status_changed"
            text = (
                f'Changed "{project.name}" from {PROJECT_STATUS_LABELS[ProjectStatus(old_status)]} '
                f"to {PROJECT_STATUS_LABELS[ProjectStatus(new_status)]}"
            )
        record_activity(
            db,
            now=now,
            event_type=event,
            entity_type=EntityType.PROJECT,
            entity_id=project.id,
            project_id=project.id,
            description=text,
            details=change_details({"status": status_change}),
        )
    if diff:
        if "name" in diff:
            text = f'Renamed project "{old_name}" to "{project.name}"'
            others = [FIELD_NAMES[key] for key in diff if key != "name"]
            if others:
                text += f" and updated {join_words(others)}"
        else:
            text = f'Updated {join_words(FIELD_NAMES[key] for key in diff)} of "{project.name}"'
        record_activity(
            db,
            now=now,
            event_type="project.updated",
            entity_type=EntityType.PROJECT,
            entity_id=project.id,
            project_id=project.id,
            description=text,
            details=change_details(diff),
        )
    db.commit()
    return project


def delete_project(db: Session, project_id: int, *, now: datetime) -> None:
    project = get_project_model(db, project_id)
    task_count = db.scalar(select(func.count(Task.id)).where(Task.project_id == project.id)) or 0
    issue_count = db.scalar(select(func.count(Issue.id)).where(Issue.project_id == project.id)) or 0
    name = project.name

    # Tasks, labels and issues are removed by ON DELETE CASCADE; activity rows keep their
    # history but lose the project link (ON DELETE SET NULL).
    db.delete(project)
    db.flush()

    parts = []
    if task_count:
        parts.append(f"{task_count} task{'s' if task_count != 1 else ''}")
    if issue_count:
        parts.append(f"{issue_count} issue{'s' if issue_count != 1 else ''}")
    suffix = f" with {join_words(parts)}" if parts else ""
    record_activity(
        db,
        now=now,
        event_type="project.deleted",
        entity_type=EntityType.PROJECT,
        entity_id=project_id,
        project_id=None,
        description=f'Deleted project "{name}"{suffix}',
        details={"task_count": task_count, "issue_count": issue_count},
    )
    db.commit()


def require_open_project(db: Session, project_id: int) -> Project:
    """Validate a project reference coming from a task or issue payload."""
    project = db.get(Project, project_id)
    if project is None:
        raise ValidationFailed(f"Project {project_id} does not exist.", field="project_id")
    if project.status == ProjectStatus.ARCHIVED:
        raise ConflictError(
            f'"{project.name}" is archived. Restore the project before adding work to it.',
            field="project_id",
        )
    return project
