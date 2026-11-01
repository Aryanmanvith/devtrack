"""Read-only endpoints: dashboard, analytics, activity feed and global search."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import Ctx, DbSession
from app.enums import EntityType
from app.schemas.common import Page
from app.schemas.insights import (
    ActivityRead,
    AnalyticsOverview,
    CompletionTrend,
    DashboardSummary,
    SearchResults,
    TaskDistribution,
    UpcomingDeadlines,
)
from app.services import insights
from app.services.activity import list_activity
from app.services.misc import search

router = APIRouter()


@router.get("/api/dashboard/summary", response_model=DashboardSummary, tags=["dashboard"])
def dashboard_summary(db: DbSession, ctx: Ctx) -> DashboardSummary:
    return insights.dashboard_summary(db, ctx)


@router.get("/api/dashboard/completion-trend", response_model=CompletionTrend, tags=["dashboard"])
def completion_trend(
    db: DbSession, ctx: Ctx, weeks: Annotated[int, Query(ge=2, le=26)] = 8
) -> CompletionTrend:
    return insights.completion_trend(db, ctx, weeks=weeks)


@router.get("/api/dashboard/task-distribution", response_model=TaskDistribution, tags=["dashboard"])
def task_distribution(db: DbSession) -> TaskDistribution:
    return insights.task_distribution(db)


@router.get(
    "/api/dashboard/upcoming-deadlines", response_model=UpcomingDeadlines, tags=["dashboard"]
)
def upcoming_deadlines(
    db: DbSession,
    ctx: Ctx,
    days: Annotated[int, Query(ge=0, le=90, description="Look-ahead window in days")] = 14,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> UpcomingDeadlines:
    return insights.upcoming_deadlines(db, ctx, days=days, limit=limit)


@router.get("/api/analytics/overview", response_model=AnalyticsOverview, tags=["analytics"])
def analytics_overview(
    db: DbSession,
    ctx: Ctx,
    weeks: Annotated[int, Query(ge=2, le=26)] = 12,
    project_id: Annotated[int | None, Query(gt=0)] = None,
) -> AnalyticsOverview:
    return insights.analytics_overview(db, ctx, weeks=weeks, project_id=project_id)


@router.get("/api/activity", response_model=Page[ActivityRead], tags=["activity"])
def activity_feed(
    db: DbSession,
    entity_type: EntityType | None = None,
    entity_id: Annotated[int | None, Query(gt=0)] = None,
    project_id: Annotated[int | None, Query(gt=0)] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[ActivityRead]:
    items, total = list_activity(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        project_id=project_id,
        q=q,
        limit=limit,
        offset=offset,
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/api/search", response_model=SearchResults, tags=["search"])
def global_search(
    db: DbSession,
    q: Annotated[str, Query(min_length=1, max_length=100)],
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> SearchResults:
    return search(db, q.strip(), limit=limit)
