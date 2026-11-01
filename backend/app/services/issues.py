"""Issue use cases: CRUD plus the open → resolved/closed → reopened lifecycle."""

from typing import Any, Literal

from sqlalchemy import ColumnElement, case, func, select
from sqlalchemy.orm import Session, contains_eager

from app.enums import (
    CLOSED_ISSUE_STATUSES,
    ISSUE_STATUS_LABELS,
    ISSUE_TYPE_LABELS,
    OPEN_ISSUE_STATUSES,
    PRIORITY_LABELS,
    PRIORITY_RANK,
    EntityType,
    IssueStatus,
    IssueType,
    Priority,
    ProjectStatus,
)
from app.errors import NotFoundError
from app.models import Issue, Project
from app.schemas.common import CountItem
from app.schemas.issues import IssueCreate, IssueSummary, IssueUpdate
from app.services.activity import change_details, join_words, record_activity
from app.services.common import contains, plain
from app.services.projects import require_open_project
from app.time_utils import TimeContext

IssueSort = Literal["created_at", "updated_at", "priority", "title"]
SortOrder = Literal["asc", "desc"]
DEFAULT_ORDER: dict[str, SortOrder] = {
    "created_at": "desc",
    "updated_at": "desc",
    "priority": "desc",
    "title": "asc",
}
FIELD_NAMES = {
    "title": "title",
    "description": "description",
    "type": "type",
    "priority": "priority",
    "project_id": "project",
}
CLOSED_VALUES = {s.value for s in CLOSED_ISSUE_STATUSES}
priority_rank = case({p.value: rank for p, rank in PRIORITY_RANK.items()}, value=Issue.priority)


def _noun(issue: Issue) -> str:
    return ISSUE_TYPE_LABELS[IssueType(issue.type)].lower()


def _conditions(
    *,
    q: str | None,
    statuses: list[IssueStatus] | None,
    types: list[IssueType] | None,
    priorities: list[Priority] | None,
    project_id: int | None,
    include_archived: bool,
) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    if project_id is not None:
        conditions.append(Issue.project_id == project_id)
    elif not include_archived:
        conditions.append(Project.status != ProjectStatus.ARCHIVED.value)
    if statuses:
        conditions.append(Issue.status.in_([s.value for s in statuses]))
    if types:
        conditions.append(Issue.type.in_([t.value for t in types]))
    if priorities:
        conditions.append(Issue.priority.in_([p.value for p in priorities]))
    if q:
        conditions.append(contains(Issue.title, q) | contains(Issue.description, q))
    return conditions


def list_issues(
    db: Session,
    *,
    q: str | None = None,
    statuses: list[IssueStatus] | None = None,
    types: list[IssueType] | None = None,
    priorities: list[Priority] | None = None,
    project_id: int | None = None,
    include_archived: bool = False,
    sort: IssueSort = "created_at",
    order: SortOrder | None = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[Issue], int]:
    conditions = _conditions(
        q=q,
        statuses=statuses,
        types=types,
        priorities=priorities,
        project_id=project_id,
        include_archived=include_archived,
    )
    total = (
        db.scalar(
            select(func.count(Issue.id))
            .join(Project, Project.id == Issue.project_id)
            .where(*conditions)
        )
        or 0
    )
    direction = order or DEFAULT_ORDER[sort]
    columns: dict[str, Any] = {
        "created_at": Issue.created_at,
        "updated_at": Issue.updated_at,
        "priority": priority_rank,
        "title": func.lower(Issue.title),
    }
    column = columns[sort]
    stmt = (
        select(Issue)
        .join(Issue.project)
        .options(contains_eager(Issue.project))
        .where(*conditions)
        .order_by(column.asc() if direction == "asc" else column.desc(), Issue.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt).all()), total


def issue_summary(db: Session, *, project_id: int | None = None) -> IssueSummary:
    conditions = _conditions(
        q=None,
        statuses=None,
        types=None,
        priorities=None,
        project_id=project_id,
        include_archived=False,
    )
    rows = db.execute(
        select(Issue.status, Issue.type, func.count(Issue.id))
        .join(Project, Project.id == Issue.project_id)
        .where(*conditions)
        .group_by(Issue.status, Issue.type)
    ).all()
    by_status = dict.fromkeys((s.value for s in IssueStatus), 0)
    by_type = dict.fromkeys((t.value for t in IssueType), 0)
    for status, issue_type, count in rows:
        by_status[status] += count
        by_type[issue_type] += count
    total = sum(by_status.values())
    open_count = sum(by_status[s.value] for s in OPEN_ISSUE_STATUSES)
    return IssueSummary(
        total=total,
        open=open_count,
        closed=total - open_count,
        by_status=[CountItem(key=key, count=value) for key, value in by_status.items()],
        by_type=[CountItem(key=key, count=value) for key, value in by_type.items()],
    )


def get_issue(db: Session, issue_id: int) -> Issue:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise NotFoundError(f"Issue {issue_id} was not found.")
    return issue


def create_issue(db: Session, data: IssueCreate, *, ctx: TimeContext) -> Issue:
    project = require_open_project(db, data.project_id)
    status = plain(data.status)
    issue = Issue(
        project_id=project.id,
        title=data.title,
        description=data.description,
        type=plain(data.type),
        priority=plain(data.priority),
        status=status,
        created_at=ctx.now,
        updated_at=ctx.now,
        resolved_at=ctx.now if status in CLOSED_VALUES else None,
    )
    db.add(issue)
    db.flush()
    record_activity(
        db,
        now=ctx.now,
        event_type="issue.created",
        entity_type=EntityType.ISSUE,
        entity_id=issue.id,
        project_id=project.id,
        description=f'Opened {_noun(issue)} "{issue.title}" in {project.name}',
        details={"type": issue.type, "priority": issue.priority, "status": status},
    )
    db.commit()
    return issue


def _status_event(issue: Issue, old: str, new: str) -> tuple[str, str]:
    noun = _noun(issue)
    if new == IssueStatus.RESOLVED:
        return "issue.resolved", f'Resolved {noun} "{issue.title}"'
    if new == IssueStatus.CLOSED:
        return "issue.closed", f'Closed {noun} "{issue.title}"'
    if old in CLOSED_VALUES:
        return "issue.reopened", f'Reopened {noun} "{issue.title}"'
    return (
        "issue.status_changed",
        f'Moved {noun} "{issue.title}" from {ISSUE_STATUS_LABELS[IssueStatus(old)]} '
        f"to {ISSUE_STATUS_LABELS[IssueStatus(new)]}",
    )


def update_issue(db: Session, issue_id: int, data: IssueUpdate, *, ctx: TimeContext) -> Issue:
    issue = get_issue(db, issue_id)
    changes = {key: plain(value) for key, value in data.model_dump(exclude_unset=True).items()}
    new_status = changes.pop("status", None)

    new_project: Project | None = None
    if "project_id" in changes and changes["project_id"] != issue.project_id:
        new_project = require_open_project(db, changes["project_id"])

    diff = {
        key: (getattr(issue, key), value)
        for key, value in changes.items()
        if getattr(issue, key) != value
    }
    status_change = (
        (issue.status, new_status)
        if new_status is not None and new_status != issue.status
        else None
    )
    if not diff and status_change is None:
        return issue

    for key, (_, value) in diff.items():
        setattr(issue, key, value)
    if status_change is not None:
        old, new = status_change
        issue.status = new
        if new in CLOSED_VALUES and old not in CLOSED_VALUES:
            issue.resolved_at = ctx.now
        elif new not in CLOSED_VALUES:
            issue.resolved_at = None
    issue.updated_at = ctx.now

    if status_change is not None:
        event, text = _status_event(issue, *status_change)
        record_activity(
            db,
            now=ctx.now,
            event_type=event,
            entity_type=EntityType.ISSUE,
            entity_id=issue.id,
            project_id=issue.project_id,
            description=text,
            details=change_details({"status": status_change}),
        )
    if diff:
        if set(diff) == {"priority"}:
            old, new = diff["priority"]
            text = (
                f'Changed priority of {_noun(issue)} "{issue.title}" from '
                f"{PRIORITY_LABELS[Priority(old)]} to {PRIORITY_LABELS[Priority(new)]}"
            )
        else:
            text = f'Updated {join_words(FIELD_NAMES[key] for key in diff)} of "{issue.title}"'
        record_activity(
            db,
            now=ctx.now,
            event_type="issue.updated",
            entity_type=EntityType.ISSUE,
            entity_id=issue.id,
            project_id=issue.project_id,
            description=text,
            details=change_details(diff),
        )
    db.commit()
    if new_project is not None:
        db.refresh(issue, attribute_names=["project"])
    return issue


def delete_issue(db: Session, issue_id: int, *, ctx: TimeContext) -> None:
    issue = get_issue(db, issue_id)
    record_activity(
        db,
        now=ctx.now,
        event_type="issue.deleted",
        entity_type=EntityType.ISSUE,
        entity_id=issue.id,
        project_id=issue.project_id,
        description=f'Deleted {_noun(issue)} "{issue.title}" from {issue.project.name}',
    )
    db.delete(issue)
    db.commit()
