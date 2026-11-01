"""Dashboard and analytics calculations. Every number is derived from stored records."""

from collections import Counter
from datetime import date, datetime, timedelta
from statistics import mean
from typing import Any

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session, contains_eager

from app.enums import (
    CLOSED_ISSUE_STATUSES,
    OPEN_ISSUE_STATUSES,
    IssueType,
    Priority,
    ProjectStatus,
    TaskStatus,
)
from app.models import Issue, Project, Task
from app.schemas.common import CountItem
from app.schemas.insights import (
    AnalyticsOverview,
    CompletionTrend,
    DailyCount,
    DashboardSummary,
    DeadlineItem,
    IssueTypeItem,
    ProjectProgressItem,
    TaskDistribution,
    TrendPoint,
    UpcomingDeadlines,
)
from app.schemas.projects import ProjectBrief
from app.schemas.tasks import TaskRead
from app.services.projects import _stats_query, get_project_model
from app.services.tasks import priority_rank
from app.time_utils import TimeContext

DONE = TaskStatus.DONE.value
ARCHIVED = ProjectStatus.ARCHIVED.value
OPEN_ISSUE_VALUES = [s.value for s in OPEN_ISSUE_STATUSES]
CLOSED_ISSUE_VALUES = {s.value for s in CLOSED_ISSUE_STATUSES}
PRIORITY_ORDER = [Priority.URGENT, Priority.HIGH, Priority.MEDIUM, Priority.LOW]


def _count_if(condition: Any) -> Any:
    return func.coalesce(func.sum(case((condition, 1), else_=0)), 0)


def dashboard_summary(db: Session, ctx: TimeContext) -> DashboardSummary:
    today = ctx.today
    week_start, week_end = ctx.week
    this_week = ctx.day_range(week_start, week_end)
    last_week = ctx.day_range(week_start - timedelta(days=7), week_start - timedelta(days=1))

    project_counts: dict[str, int] = dict(
        db.execute(select(Project.status, func.count(Project.id)).group_by(Project.status)).all()
    )
    is_done = Task.status == DONE
    is_open = Task.status != DONE
    row = db.execute(
        select(
            func.count(Task.id),
            _count_if(is_open),
            _count_if(Task.status == TaskStatus.IN_PROGRESS.value),
            _count_if(
                and_(is_done, Task.completed_at >= this_week[0], Task.completed_at < this_week[1])
            ),
            _count_if(
                and_(is_done, Task.completed_at >= last_week[0], Task.completed_at < last_week[1])
            ),
            _count_if(and_(is_open, Task.due_date < today)),
            _count_if(and_(is_open, Task.due_date == today)),
            _count_if(and_(is_open, Task.due_date >= today, Task.due_date <= week_end)),
        )
        .join(Project, Project.id == Task.project_id)
        .where(Project.status != ARCHIVED)
    ).one()
    open_issues = (
        db.scalar(
            select(func.count(Issue.id))
            .join(Project, Project.id == Issue.project_id)
            .where(Project.status != ARCHIVED, Issue.status.in_(OPEN_ISSUE_VALUES))
        )
        or 0
    )
    total, open_tasks, in_progress, done_week, done_last, overdue, due_today, due_week = (
        int(value) for value in row
    )
    return DashboardSummary(
        today=today,
        week_start=week_start,
        week_end=week_end,
        timezone=ctx.timezone_name,
        active_projects=project_counts.get(ProjectStatus.ACTIVE.value, 0),
        open_projects=sum(
            project_counts.get(s.value, 0)
            for s in (ProjectStatus.PLANNING, ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD)
        ),
        total_projects=sum(count for status, count in project_counts.items() if status != ARCHIVED),
        total_tasks=total,
        open_tasks=open_tasks,
        in_progress_tasks=in_progress,
        completed_this_week=done_week,
        completed_last_week=done_last,
        overdue_tasks=overdue,
        due_today=due_today,
        due_this_week=due_week,
        open_issues=open_issues,
    )


def weekly_points(
    ctx: TimeContext,
    rows: list[tuple[datetime, datetime | None]],
    first_week_start: date,
    weeks: int,
) -> list[TrendPoint]:
    """Bucket task (created_at, completed_at) pairs into local calendar weeks."""
    points: list[TrendPoint] = []
    for index in range(weeks):
        start_day = first_week_start + timedelta(weeks=index)
        end_day = start_day + timedelta(days=6)
        start, end = ctx.day_range(start_day, end_day)
        cutoff = min(end, ctx.now)
        points.append(
            TrendPoint(
                week_start=start_day,
                week_end=end_day,
                completed=sum(1 for _, done in rows if done is not None and start <= done < end),
                created=sum(1 for made, _ in rows if start <= made < end),
                remaining=sum(
                    1 for made, done in rows if made < cutoff and (done is None or done >= cutoff)
                ),
            )
        )
    return points


def completion_trend(db: Session, ctx: TimeContext, *, weeks: int) -> CompletionTrend:
    week_start, _ = ctx.week
    rows = [
        (created, completed)
        for created, completed in db.execute(
            select(Task.created_at, Task.completed_at)
            .join(Project, Project.id == Task.project_id)
            .where(Project.status != ARCHIVED)
        ).all()
    ]
    first = week_start - timedelta(weeks=weeks - 1)
    return CompletionTrend(
        weeks=weeks, today=ctx.today, points=weekly_points(ctx, rows, first, weeks)
    )


def task_distribution(db: Session) -> TaskDistribution:
    rows = db.execute(
        select(Task.status, Task.priority, func.count(Task.id))
        .join(Project, Project.id == Task.project_id)
        .where(Project.status != ARCHIVED)
        .group_by(Task.status, Task.priority)
    ).all()
    by_status = dict.fromkeys((s.value for s in TaskStatus), 0)
    by_priority = dict.fromkeys((p.value for p in PRIORITY_ORDER), 0)
    for status, priority, count in rows:
        by_status[status] += count
        if status != DONE:
            by_priority[priority] += count
    return TaskDistribution(
        total=sum(by_status.values()),
        open_total=sum(by_priority.values()),
        by_status=[CountItem(key=k, count=v) for k, v in by_status.items()],
        by_priority=[CountItem(key=k, count=v) for k, v in by_priority.items()],
    )


def upcoming_deadlines(
    db: Session, ctx: TimeContext, *, days: int, limit: int
) -> UpcomingDeadlines:
    today = ctx.today
    horizon = today + timedelta(days=days)
    base = [
        Project.status != ARCHIVED,
        Task.status != DONE,
        Task.due_date.is_not(None),
        Task.due_date <= horizon,
    ]
    counts = db.execute(
        select(_count_if(Task.due_date < today), _count_if(Task.due_date >= today))
        .select_from(Task)
        .join(Project, Project.id == Task.project_id)
        .where(*base)
    ).one()
    tasks = db.scalars(
        select(Task)
        .join(Task.project)
        .options(contains_eager(Task.project))
        .where(*base)
        .order_by(Task.due_date, priority_rank.desc(), Task.id)
        .limit(limit)
    ).all()
    items = []
    for task in tasks:
        assert task.due_date is not None
        days_until = (task.due_date - today).days
        items.append(
            DeadlineItem(
                **TaskRead.model_validate(task).model_dump(),
                days_until=days_until,
                is_overdue=days_until < 0,
            )
        )
    return UpcomingDeadlines(
        today=today,
        days=days,
        overdue_count=int(counts[0]),
        upcoming_count=int(counts[1]),
        items=items,
    )


def analytics_overview(
    db: Session, ctx: TimeContext, *, weeks: int, project_id: int | None
) -> AnalyticsOverview:
    if project_id is not None:
        get_project_model(db, project_id)  # 404 for unknown projects
        task_scope = [Task.project_id == project_id]
        issue_scope = [Issue.project_id == project_id]
        project_scope = [Project.id == project_id]
    else:
        task_scope = [Project.status != ARCHIVED]
        issue_scope = [Project.status != ARCHIVED]
        project_scope = [Project.status != ARCHIVED]

    today = ctx.today
    week_start, week_end = ctx.week
    range_start = week_start - timedelta(weeks=weeks - 1)
    range_from, range_to = ctx.day_range(range_start, week_end)

    tasks = db.execute(
        select(Task.status, Task.priority, Task.created_at, Task.completed_at, Task.due_date)
        .join(Project, Project.id == Task.project_id)
        .where(*task_scope)
    ).all()
    total = len(tasks)
    done = sum(1 for t in tasks if t.status == DONE)
    overdue = sum(
        1 for t in tasks if t.status != DONE and t.due_date is not None and t.due_date < today
    )
    completed_in_range = [
        t for t in tasks if t.completed_at is not None and range_from <= t.completed_at < range_to
    ]
    cycle_days = [
        (t.completed_at - t.created_at).total_seconds() / 86400 for t in completed_in_range
    ]

    status_counts = Counter(t.status for t in tasks)
    priority_counts = Counter(t.priority for t in tasks if t.status != DONE)
    daily = Counter(ctx.local_date(t.completed_at) for t in completed_in_range)
    day_count = (week_end - range_start).days + 1

    progress_rows = db.execute(_stats_query(today)[0].where(*project_scope)).all()
    project_progress = []
    for project, task_count, done_count, _overdue, _issues in progress_rows:
        task_count, done_count = int(task_count), int(done_count)
        project_progress.append(
            ProjectProgressItem(
                project=ProjectBrief.model_validate(project),
                total=task_count,
                done=done_count,
                open=task_count - done_count,
                progress=(done_count * 100) // task_count if task_count else 0,
            )
        )
    project_progress.sort(key=lambda item: (-item.progress, item.project.name.lower()))

    issues = db.execute(
        select(Issue.type, Issue.status, Issue.resolved_at)
        .join(Project, Project.id == Issue.project_id)
        .where(*issue_scope)
    ).all()
    issues_by_type = [
        IssueTypeItem(
            type=issue_type,
            open=sum(
                1 for i in issues if i.type == issue_type and i.status not in CLOSED_ISSUE_VALUES
            ),
            closed=sum(
                1 for i in issues if i.type == issue_type and i.status in CLOSED_ISSUE_VALUES
            ),
        )
        for issue_type in IssueType
    ]

    return AnalyticsOverview(
        today=today,
        weeks=weeks,
        range_start=range_start,
        range_end=week_end,
        project_id=project_id,
        total_tasks=total,
        completed_tasks=done,
        open_tasks=total - done,
        overdue_tasks=overdue,
        completion_rate=round(done * 100 / total, 1) if total else 0.0,
        completed_in_range=len(completed_in_range),
        created_in_range=sum(1 for t in tasks if range_from <= t.created_at < range_to),
        avg_cycle_days=round(mean(cycle_days), 1) if cycle_days else None,
        open_issues=sum(1 for i in issues if i.status not in CLOSED_ISSUE_VALUES),
        resolved_issues_in_range=sum(
            1
            for i in issues
            if i.resolved_at is not None and range_from <= i.resolved_at < range_to
        ),
        by_status=[CountItem(key=s.value, count=status_counts.get(s.value, 0)) for s in TaskStatus],
        by_priority=[
            CountItem(key=p.value, count=priority_counts.get(p.value, 0)) for p in PRIORITY_ORDER
        ],
        weekly=weekly_points(
            ctx, [(t.created_at, t.completed_at) for t in tasks], range_start, weeks
        ),
        daily_completions=[
            DailyCount(date=day, count=daily.get(day, 0))
            for day in (range_start + timedelta(days=offset) for offset in range(day_count))
        ],
        project_progress=project_progress,
        issues_by_type=issues_by_type,
    )
