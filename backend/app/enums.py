"""Domain vocabularies shared by models, schemas and services."""

from enum import StrEnum


class ProjectStatus(StrEnum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ProjectColor(StrEnum):
    INDIGO = "indigo"
    VIOLET = "violet"
    SKY = "sky"
    TEAL = "teal"
    EMERALD = "emerald"
    AMBER = "amber"
    ROSE = "rose"
    SLATE = "slate"


class TaskStatus(StrEnum):
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class IssueType(StrEnum):
    BUG = "bug"
    FEATURE = "feature"
    IMPROVEMENT = "improvement"
    QUESTION = "question"


class IssueStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Theme(StrEnum):
    DARK = "dark"
    LIGHT = "light"
    SYSTEM = "system"


class WeekStart(StrEnum):
    MONDAY = "monday"
    SUNDAY = "sunday"


class EntityType(StrEnum):
    PROJECT = "project"
    TASK = "task"
    ISSUE = "issue"
    SYSTEM = "system"


OPEN_TASK_STATUSES = (
    TaskStatus.BACKLOG,
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.IN_REVIEW,
)
OPEN_ISSUE_STATUSES = (IssueStatus.OPEN, IssueStatus.IN_PROGRESS)
CLOSED_ISSUE_STATUSES = (IssueStatus.RESOLVED, IssueStatus.CLOSED)

# Ordering used for "priority" sorting: a higher rank is more urgent.
PRIORITY_RANK = {Priority.LOW: 1, Priority.MEDIUM: 2, Priority.HIGH: 3, Priority.URGENT: 4}

# Human-readable names used in activity descriptions (the frontend uses the same wording).
PROJECT_STATUS_LABELS = {
    ProjectStatus.PLANNING: "Planning",
    ProjectStatus.ACTIVE: "Active",
    ProjectStatus.ON_HOLD: "On Hold",
    ProjectStatus.COMPLETED: "Completed",
    ProjectStatus.ARCHIVED: "Archived",
}
TASK_STATUS_LABELS = {
    TaskStatus.BACKLOG: "Backlog",
    TaskStatus.TODO: "To Do",
    TaskStatus.IN_PROGRESS: "In Progress",
    TaskStatus.IN_REVIEW: "In Review",
    TaskStatus.DONE: "Done",
}
PRIORITY_LABELS = {
    Priority.LOW: "Low",
    Priority.MEDIUM: "Medium",
    Priority.HIGH: "High",
    Priority.URGENT: "Urgent",
}
ISSUE_TYPE_LABELS = {
    IssueType.BUG: "Bug",
    IssueType.FEATURE: "Feature request",
    IssueType.IMPROVEMENT: "Improvement",
    IssueType.QUESTION: "Question",
}
ISSUE_STATUS_LABELS = {
    IssueStatus.OPEN: "Open",
    IssueStatus.IN_PROGRESS: "In Progress",
    IssueStatus.RESOLVED: "Resolved",
    IssueStatus.CLOSED: "Closed",
}
