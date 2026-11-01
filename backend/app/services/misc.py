"""Preferences and global search."""

from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, contains_eager

from app.enums import ProjectStatus
from app.models import Issue, Project, Task, UserPreferences
from app.schemas.insights import (
    IssueSearchHit,
    PreferencesUpdate,
    SearchResults,
    TaskSearchHit,
)
from app.schemas.projects import ProjectBrief
from app.services.common import contains, plain
from app.time_utils import utcnow


def get_preferences(db: Session) -> UserPreferences:
    prefs = db.scalar(select(UserPreferences).order_by(UserPreferences.id).limit(1))
    if prefs is None:
        now = utcnow()
        prefs = UserPreferences(created_at=now, updated_at=now)
        db.add(prefs)
        db.commit()
    return prefs


def update_preferences(db: Session, data: PreferencesUpdate, *, now: datetime) -> UserPreferences:
    prefs = get_preferences(db)
    changed = False
    for key, value in data.model_dump(exclude_unset=True).items():
        value = plain(value)
        if getattr(prefs, key) != value:
            setattr(prefs, key, value)
            changed = True
    if changed:
        prefs.updated_at = now
        db.commit()
    return prefs


def search(db: Session, q: str, *, limit: int) -> SearchResults:
    projects = db.scalars(
        select(Project)
        .where(or_(contains(Project.name, q), contains(Project.description, q)))
        .order_by(Project.status == ProjectStatus.ARCHIVED.value, func.lower(Project.name))
        .limit(limit)
    ).all()
    tasks = db.scalars(
        select(Task)
        .join(Task.project)
        .options(contains_eager(Task.project))
        .where(or_(contains(Task.title, q), contains(Task.description, q)))
        .order_by(Task.updated_at.desc(), Task.id.desc())
        .limit(limit)
    ).all()
    issues = db.scalars(
        select(Issue)
        .join(Issue.project)
        .options(contains_eager(Issue.project))
        .where(or_(contains(Issue.title, q), contains(Issue.description, q)))
        .order_by(Issue.updated_at.desc(), Issue.id.desc())
        .limit(limit)
    ).all()
    return SearchResults(
        query=q,
        projects=[ProjectBrief.model_validate(p) for p in projects],
        tasks=[TaskSearchHit.model_validate(t) for t in tasks],
        issues=[IssueSearchHit.model_validate(i) for i in issues],
    )
