"""Activity log.

Every mutation records exactly what changed, in plain language, inside the same database
transaction as the change itself, so the log can never claim something that was rolled back.
"""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.enums import EntityType
from app.models import Activity, Issue, Project, Task
from app.schemas.insights import ActivityRead
from app.schemas.projects import ProjectBrief
from app.services.common import contains, jsonable

ENTITY_MODELS: dict[str, type[Project] | type[Task] | type[Issue]] = {
    EntityType.PROJECT: Project,
    EntityType.TASK: Task,
    EntityType.ISSUE: Issue,
}


def record_activity(
    db: Session,
    *,
    now: datetime,
    event_type: str,
    entity_type: EntityType,
    entity_id: int | None,
    project_id: int | None,
    description: str,
    details: dict[str, Any] | None = None,
) -> Activity:
    activity = Activity(
        event_type=event_type,
        entity_type=entity_type.value,
        entity_id=entity_id,
        project_id=project_id,
        description=description[:500],
        details=details,
        created_at=now,
    )
    db.add(activity)
    return activity


def change_details(diff: Mapping[str, tuple[Any, Any]]) -> dict[str, Any]:
    return {
        "changes": {
            field: {"from": jsonable(old), "to": jsonable(new)}
            for field, (old, new) in diff.items()
        }
    }


def join_words(words: Iterable[str]) -> str:
    items = list(words)
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _existing_ids(db: Session, activities: list[Activity]) -> dict[str, set[int]]:
    wanted: dict[str, set[int]] = defaultdict(set)
    for activity in activities:
        if activity.entity_type in ENTITY_MODELS and activity.entity_id is not None:
            wanted[activity.entity_type].add(activity.entity_id)
    found: dict[str, set[int]] = {}
    for entity_type, ids in wanted.items():
        model = ENTITY_MODELS[entity_type]
        found[entity_type] = set(db.scalars(select(model.id).where(model.id.in_(ids))))
    return found


def list_activity(
    db: Session,
    *,
    entity_type: EntityType | None = None,
    entity_id: int | None = None,
    project_id: int | None = None,
    q: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> tuple[list[ActivityRead], int]:
    conditions = []
    if entity_type is not None:
        conditions.append(Activity.entity_type == entity_type.value)
    if entity_id is not None:
        conditions.append(Activity.entity_id == entity_id)
    if project_id is not None:
        conditions.append(Activity.project_id == project_id)
    if q:
        conditions.append(contains(Activity.description, q))

    total = db.scalar(select(func.count(Activity.id)).where(*conditions)) or 0
    rows = db.execute(
        select(Activity, Project)
        .outerjoin(Project, Project.id == Activity.project_id)
        .where(*conditions)
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    activities = [activity for activity, _ in rows]
    existing = _existing_ids(db, activities)
    items: list[ActivityRead] = []
    for activity, project in rows:
        if activity.entity_type in ENTITY_MODELS:
            exists = activity.entity_id in existing.get(activity.entity_type, set())
        else:
            exists = None
        items.append(
            ActivityRead(
                id=activity.id,
                event_type=activity.event_type,
                entity_type=activity.entity_type,
                entity_id=activity.entity_id,
                project_id=activity.project_id,
                project=ProjectBrief.model_validate(project) if project is not None else None,
                description=activity.description,
                details=activity.details,
                created_at=activity.created_at,
                entity_exists=exists,
            )
        )
    return items, total
