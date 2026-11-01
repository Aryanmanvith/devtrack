"""Demo workspace.

Demo records are ordinary rows stored through the normal ORM layer, flagged with
``is_demo = True`` so the interface can label them and Settings can remove them.
Their timestamps are spread over recent weeks so charts have history to show; the
only activity entry written is a single, truthful "demo workspace loaded" event.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.enums import (
    CLOSED_ISSUE_STATUSES,
    EntityType,
    IssueStatus,
    IssueType,
    Priority,
    ProjectColor,
    ProjectStatus,
    TaskStatus,
)
from app.errors import ConflictError
from app.models import Issue, Project, Task, TaskLabel
from app.schemas.insights import DemoRemoval, DemoStatus
from app.services.activity import record_activity
from app.time_utils import TimeContext

S, P, T = TaskStatus, Priority, IssueType


@dataclass(frozen=True)
class DemoTask:
    title: str
    status: TaskStatus
    priority: Priority
    labels: tuple[str, ...]
    created_days_ago: int
    due_in_days: int | None = None
    completed_days_ago: int | None = None
    description: str = ""


@dataclass(frozen=True)
class DemoIssue:
    title: str
    type: IssueType
    priority: Priority
    status: IssueStatus
    created_days_ago: int
    resolved_days_ago: int | None = None
    description: str = ""


@dataclass(frozen=True)
class DemoProject:
    name: str
    description: str
    status: ProjectStatus
    color: ProjectColor
    owner: str
    start_in_days: int
    due_in_days: int
    tasks: tuple[DemoTask, ...] = field(default_factory=tuple)
    issues: tuple[DemoIssue, ...] = field(default_factory=tuple)


DEMO_PROJECTS: tuple[DemoProject, ...] = (
    DemoProject(
        name="Campus Events Platform",
        description=(
            "Web app where student societies publish events and members RSVP. "
            "React frontend with a FastAPI backend."
        ),
        status=ProjectStatus.ACTIVE,
        color=ProjectColor.INDIGO,
        owner="Priya Raman",
        start_in_days=-42,
        due_in_days=24,
        tasks=(
            DemoTask(
                "Set up FastAPI project and SQLite models",
                S.DONE,
                P.HIGH,
                ("backend",),
                41,
                completed_days_ago=37,
                description="Repository layout, SQLAlchemy setup and the Event and RSVP models.",
            ),
            DemoTask(
                "Design event card and RSVP flow",
                S.DONE,
                P.MEDIUM,
                ("design",),
                40,
                completed_days_ago=34,
            ),
            DemoTask(
                "Implement event CRUD endpoints",
                S.DONE,
                P.HIGH,
                ("api", "backend"),
                36,
                completed_days_ago=27,
            ),
            DemoTask(
                "Build event listing page with filters",
                S.DONE,
                P.MEDIUM,
                ("frontend",),
                30,
                completed_days_ago=19,
            ),
            DemoTask(
                "Write README setup section", S.DONE, P.MEDIUM, ("docs",), 4, completed_days_ago=0
            ),
            DemoTask(
                "Add RSVP button with optimistic updates",
                S.IN_REVIEW,
                P.HIGH,
                ("frontend",),
                15,
                due_in_days=2,
                description="Roll back the RSVP count if the request fails.",
            ),
            DemoTask(
                "Write API tests for RSVP capacity limits",
                S.IN_PROGRESS,
                P.MEDIUM,
                ("backend", "testing"),
                12,
                due_in_days=5,
            ),
            DemoTask(
                "Fix time zone bug in event start times",
                S.IN_PROGRESS,
                P.URGENT,
                ("backend", "bug"),
                6,
                due_in_days=-2,
                description="Start times are stored in UTC but rendered without conversion.",
            ),
            DemoTask(
                "Prepare sprint 3 demo for the society committee",
                S.TODO,
                P.HIGH,
                ("docs",),
                3,
                due_in_days=1,
            ),
            DemoTask(
                "Send email reminders before events", S.TODO, P.LOW, ("backend",), 9, due_in_days=18
            ),
            DemoTask(
                "Accessibility audit of event pages", S.BACKLOG, P.MEDIUM, ("a11y", "frontend"), 5
            ),
        ),
        issues=(
            DemoIssue(
                "RSVP count does not update after cancelling",
                T.BUG,
                P.HIGH,
                IssueStatus.OPEN,
                4,
                description="Cancelling an RSVP leaves the attendee count unchanged until reload.",
            ),
            DemoIssue(
                "Event times show in UTC instead of local time",
                T.BUG,
                P.URGENT,
                IssueStatus.IN_PROGRESS,
                7,
            ),
            DemoIssue("Export attendee list as CSV", T.FEATURE, P.MEDIUM, IssueStatus.OPEN, 10),
            DemoIssue(
                "Event page takes four seconds to load on mobile",
                T.IMPROVEMENT,
                P.MEDIUM,
                IssueStatus.RESOLVED,
                16,
                resolved_days_ago=5,
            ),
            DemoIssue(
                "Should past events stay visible on the homepage?",
                T.QUESTION,
                P.LOW,
                IssueStatus.CLOSED,
                20,
                resolved_days_ago=11,
            ),
        ),
    ),
    DemoProject(
        name="Study Buddy Mobile App",
        description=(
            "Mobile app that matches classmates into study groups by course and availability."
        ),
        status=ProjectStatus.ACTIVE,
        color=ProjectColor.VIOLET,
        owner="Marcus Lee",
        start_in_days=-28,
        due_in_days=38,
        tasks=(
            DemoTask(
                "Interview classmates about study habits",
                S.DONE,
                P.MEDIUM,
                ("research",),
                27,
                completed_days_ago=23,
            ),
            DemoTask(
                "Define matching algorithm requirements",
                S.DONE,
                P.HIGH,
                ("docs",),
                22,
                completed_days_ago=16,
            ),
            DemoTask(
                "Build onboarding screens",
                S.DONE,
                P.MEDIUM,
                ("frontend", "mobile"),
                18,
                completed_days_ago=10,
            ),
            DemoTask(
                "Integrate course catalogue API",
                S.DONE,
                P.HIGH,
                ("api", "backend"),
                13,
                completed_days_ago=2,
            ),
            DemoTask(
                "Availability calendar widget",
                S.IN_PROGRESS,
                P.HIGH,
                ("frontend", "mobile"),
                9,
                due_in_days=4,
            ),
            DemoTask(
                "Matching score unit tests", S.TODO, P.MEDIUM, ("testing",), 8, due_in_days=-1
            ),
            DemoTask(
                "Push notification prototype", S.TODO, P.MEDIUM, ("mobile",), 6, due_in_days=12
            ),
            DemoTask("Prepare app store screenshots", S.BACKLOG, P.LOW, ("design",), 5),
        ),
        issues=(
            DemoIssue(
                "Onboarding skips the course step on Android", T.BUG, P.HIGH, IssueStatus.OPEN, 3
            ),
            DemoIssue("Dark mode for the study timer", T.FEATURE, P.LOW, IssueStatus.OPEN, 12),
        ),
    ),
    DemoProject(
        name="Library Seat Finder",
        description="Prototype that shows free seats in the campus library using desk sensors.",
        status=ProjectStatus.PLANNING,
        color=ProjectColor.SKY,
        owner="Elena Petrova",
        start_in_days=3,
        due_in_days=70,
        tasks=(
            DemoTask(
                "Research desk occupancy sensors",
                S.IN_PROGRESS,
                P.MEDIUM,
                ("hardware", "research"),
                7,
                due_in_days=6,
            ),
            DemoTask(
                "Draft project proposal for supervisor",
                S.TODO,
                P.HIGH,
                ("docs",),
                10,
                due_in_days=-3,
            ),
            DemoTask(
                "Order prototype hardware", S.BACKLOG, P.MEDIUM, ("hardware",), 4, due_in_days=20
            ),
            DemoTask("Sketch the floor map interface", S.BACKLOG, P.LOW, ("design",), 2),
        ),
        issues=(
            DemoIssue(
                "Which sensor supplier offers student discounts?",
                T.QUESTION,
                P.MEDIUM,
                IssueStatus.OPEN,
                6,
            ),
        ),
    ),
    DemoProject(
        name="Portfolio Site Refresh",
        description="Personal portfolio rebuilt as a static site with case studies.",
        status=ProjectStatus.COMPLETED,
        color=ProjectColor.EMERALD,
        owner="Sam Okafor",
        start_in_days=-60,
        due_in_days=-10,
        tasks=(
            DemoTask(
                "Migrate content to the new static site",
                S.DONE,
                P.MEDIUM,
                ("frontend",),
                58,
                completed_days_ago=48,
            ),
            DemoTask(
                "Write the Campus Events case study",
                S.DONE,
                P.MEDIUM,
                ("docs",),
                52,
                completed_days_ago=44,
            ),
            DemoTask(
                "Lighthouse performance pass",
                S.DONE,
                P.HIGH,
                ("frontend", "performance"),
                47,
                completed_days_ago=40,
            ),
            DemoTask(
                "Configure custom domain and HTTPS",
                S.DONE,
                P.MEDIUM,
                ("devops",),
                45,
                completed_days_ago=38,
            ),
            DemoTask(
                "Add dark mode toggle", S.DONE, P.LOW, ("frontend",), 30, completed_days_ago=14
            ),
        ),
        issues=(
            DemoIssue(
                "Broken link in the footer",
                T.BUG,
                P.LOW,
                IssueStatus.RESOLVED,
                25,
                resolved_days_ago=15,
            ),
        ),
    ),
)

CLOSED_VALUES = {s.value for s in CLOSED_ISSUE_STATUSES}


def demo_status(db: Session) -> DemoStatus:
    projects = db.scalar(select(func.count(Project.id)).where(Project.is_demo.is_(True))) or 0
    tasks = db.scalar(select(func.count(Task.id)).where(Task.is_demo.is_(True))) or 0
    issues = db.scalar(select(func.count(Issue.id)).where(Issue.is_demo.is_(True))) or 0
    user_tasks = (
        db.scalar(
            select(func.count(Task.id))
            .join(Project, Project.id == Task.project_id)
            .where(Project.is_demo.is_(True), Task.is_demo.is_(False))
        )
        or 0
    )
    user_issues = (
        db.scalar(
            select(func.count(Issue.id))
            .join(Project, Project.id == Issue.project_id)
            .where(Project.is_demo.is_(True), Issue.is_demo.is_(False))
        )
        or 0
    )
    return DemoStatus(
        has_demo_data=bool(projects or tasks or issues),
        projects=projects,
        tasks=tasks,
        issues=issues,
        user_tasks_in_demo_projects=user_tasks,
        user_issues_in_demo_projects=user_issues,
    )


def _ago(now: datetime, days: int, hours: int) -> datetime:
    return now - timedelta(days=days, hours=hours)


def seed_demo(db: Session, ctx: TimeContext, *, commit: bool = True) -> DemoStatus:
    if demo_status(db).has_demo_data:
        raise ConflictError("Demo data is already loaded. Remove it first to load a fresh copy.")
    existing = {
        name.lower()
        for name in db.scalars(
            select(Project.name).where(Project.name.in_([p.name for p in DEMO_PROJECTS]))
        )
    }
    clash = next((p.name for p in DEMO_PROJECTS if p.name.lower() in existing), None)
    if clash:
        raise ConflictError(f'Cannot load demo data: a project named "{clash}" already exists.')

    now, today = ctx.now, ctx.today
    positions: dict[TaskStatus, float] = {
        status: db.scalar(select(func.max(Task.position)).where(Task.status == status.value)) or 0.0
        for status in TaskStatus
    }
    task_total = issue_total = 0
    for spec in DEMO_PROJECTS:
        oldest = max(
            [t.created_days_ago for t in spec.tasks] + [i.created_days_ago for i in spec.issues]
        )
        project = Project(
            name=spec.name,
            description=spec.description,
            status=spec.status.value,
            color=spec.color.value,
            owner=spec.owner,
            start_date=today + timedelta(days=spec.start_in_days),
            due_date=today + timedelta(days=spec.due_in_days),
            is_demo=True,
            created_at=_ago(now, oldest + 1, 3),
            updated_at=_ago(now, 1, 1),
        )
        db.add(project)
        for index, item in enumerate(spec.tasks):
            created = _ago(now, item.created_days_ago, 2 + index % 5)
            completed = None
            if item.completed_days_ago is not None:
                completed = max(_ago(now, item.completed_days_ago, 1 + index % 3), created)
            positions[item.status] += 1024.0
            task = Task(
                project=project,
                title=item.title,
                description=item.description,
                status=item.status.value,
                priority=item.priority.value,
                due_date=today + timedelta(days=item.due_in_days)
                if item.due_in_days is not None
                else None,
                position=positions[item.status],
                is_demo=True,
                created_at=created,
                updated_at=completed or created,
                completed_at=completed,
            )
            task.label_links = [TaskLabel(name=label) for label in item.labels]
            db.add(task)
            task_total += 1
        for index, item in enumerate(spec.issues):
            created = _ago(now, item.created_days_ago, 4 + index % 4)
            resolved = None
            if item.status.value in CLOSED_VALUES:
                resolved = max(_ago(now, item.resolved_days_ago or 0, 2), created)
            db.add(
                Issue(
                    project=project,
                    title=item.title,
                    description=item.description,
                    type=item.type.value,
                    priority=item.priority.value,
                    status=item.status.value,
                    is_demo=True,
                    created_at=created,
                    updated_at=resolved or created,
                    resolved_at=resolved,
                )
            )
            issue_total += 1
    db.flush()
    record_activity(
        db,
        now=now,
        event_type="demo.seeded",
        entity_type=EntityType.SYSTEM,
        entity_id=None,
        project_id=None,
        description=(
            f"Loaded the demo workspace: {len(DEMO_PROJECTS)} projects, "
            f"{task_total} tasks and {issue_total} issues tagged Demo"
        ),
    )
    if commit:
        db.commit()
    return demo_status(db)


def remove_demo(db: Session, *, now: datetime) -> DemoRemoval:
    demo_project_ids = list(db.scalars(select(Project.id).where(Project.is_demo.is_(True))))
    task_count = (
        db.scalar(
            select(func.count(Task.id)).where(
                Task.is_demo.is_(True) | Task.project_id.in_(demo_project_ids)
            )
        )
        or 0
    )
    issue_count = (
        db.scalar(
            select(func.count(Issue.id)).where(
                Issue.is_demo.is_(True) | Issue.project_id.in_(demo_project_ids)
            )
        )
        or 0
    )
    # Demo tasks or issues that were moved into the user's own projects are removed too.
    for task in db.scalars(select(Task).where(Task.is_demo.is_(True))):
        db.delete(task)
    for issue in db.scalars(select(Issue).where(Issue.is_demo.is_(True))):
        db.delete(issue)
    for project in db.scalars(select(Project).where(Project.is_demo.is_(True))):
        db.delete(project)
    db.flush()
    record_activity(
        db,
        now=now,
        event_type="demo.removed",
        entity_type=EntityType.SYSTEM,
        entity_id=None,
        project_id=None,
        description=(
            f"Removed demo data: {len(demo_project_ids)} projects, {task_count} tasks "
            f"and {issue_count} issues"
        ),
    )
    db.commit()
    return DemoRemoval(
        removed_projects=len(demo_project_ids), removed_tasks=task_count, removed_issues=issue_count
    )
