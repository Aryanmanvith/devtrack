"""Initial schema: projects, tasks, task labels, issues, activity log and preferences.

Revision ID: 0001
Revises:
Create Date: 2026-11-01

Generated with ``alembic revision --autogenerate`` and then reviewed by hand:
* timestamp columns use plain DateTime (the app stores UTC via a TypeDecorator);
* the case-insensitive unique index on project names was added manually because
  autogenerate does not detect expression-based indexes on SQLite.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PRIORITIES = "'low', 'medium', 'high', 'urgent'"


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("owner", sa.String(length=80), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "color IN ('indigo', 'violet', 'sky', 'teal', 'emerald', 'amber', 'rose', 'slate')",
            name=op.f("ck_projects_color"),
        ),
        sa.CheckConstraint(
            "status IN ('planning', 'active', 'on_hold', 'completed', 'archived')",
            name=op.f("ck_projects_status"),
        ),
        sa.CheckConstraint(
            "start_date IS NULL OR due_date IS NULL OR due_date >= start_date",
            name=op.f("ck_projects_date_order"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
    )
    op.create_index(op.f("ix_projects_status"), "projects", ["status"], unique=False)
    op.create_index("uq_projects_name_lower", "projects", [sa.text("lower(name)")], unique=True)

    op.create_table(
        "user_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=60), nullable=False),
        sa.Column("theme", sa.String(length=10), nullable=False),
        sa.Column("week_start", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "theme IN ('dark', 'light', 'system')", name=op.f("ck_user_preferences_theme")
        ),
        sa.CheckConstraint(
            "week_start IN ('monday', 'sunday')", name=op.f("ck_user_preferences_week_start")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_preferences")),
    )

    op.create_table(
        "activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("entity_type", sa.String(length=20), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "entity_type IN ('project', 'task', 'issue', 'system')",
            name=op.f("ck_activities_entity_type"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_activities_project_id_projects"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activities")),
    )
    op.create_index(op.f("ix_activities_created_at"), "activities", ["created_at"], unique=False)
    op.create_index("ix_activities_entity", "activities", ["entity_type", "entity_id"], unique=False)
    op.create_index(op.f("ix_activities_event_type"), "activities", ["event_type"], unique=False)
    op.create_index(op.f("ix_activities_project_id"), "activities", ["project_id"], unique=False)

    op.create_table(
        "issues",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "(status IN ('resolved', 'closed')) = (resolved_at IS NOT NULL)",
            name=op.f("ck_issues_resolved_at_matches_status"),
        ),
        sa.CheckConstraint(f"priority IN ({PRIORITIES})", name=op.f("ck_issues_priority")),
        sa.CheckConstraint(
            "status IN ('open', 'in_progress', 'resolved', 'closed')", name=op.f("ck_issues_status")
        ),
        sa.CheckConstraint(
            "type IN ('bug', 'feature', 'improvement', 'question')", name=op.f("ck_issues_type")
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_issues_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_issues")),
    )
    op.create_index(op.f("ix_issues_project_id"), "issues", ["project_id"], unique=False)
    op.create_index(op.f("ix_issues_status"), "issues", ["status"], unique=False)

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("position", sa.Float(), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "(status = 'done') = (completed_at IS NOT NULL)",
            name=op.f("ck_tasks_completed_at_matches_status"),
        ),
        sa.CheckConstraint(f"priority IN ({PRIORITIES})", name=op.f("ck_tasks_priority")),
        sa.CheckConstraint(
            "status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done')",
            name=op.f("ck_tasks_status"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_tasks_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index(op.f("ix_tasks_completed_at"), "tasks", ["completed_at"], unique=False)
    op.create_index(op.f("ix_tasks_due_date"), "tasks", ["due_date"], unique=False)
    op.create_index(op.f("ix_tasks_project_id"), "tasks", ["project_id"], unique=False)
    op.create_index("ix_tasks_status_position", "tasks", ["status", "position"], unique=False)

    op.create_table(
        "task_labels",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=24), nullable=False),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            name=op.f("fk_task_labels_task_id_tasks"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_task_labels")),
        sa.UniqueConstraint("task_id", "name", name="uq_task_labels_task_id_name"),
    )
    op.create_index(op.f("ix_task_labels_name"), "task_labels", ["name"], unique=False)


def downgrade() -> None:
    op.drop_table("task_labels")
    op.drop_table("tasks")
    op.drop_table("issues")
    op.drop_table("activities")
    op.drop_table("user_preferences")
    op.drop_index("uq_projects_name_lower", table_name="projects")
    op.drop_table("projects")
