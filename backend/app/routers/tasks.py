from datetime import date
from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.deps import Ctx, DbSession
from app.enums import Priority, TaskStatus
from app.schemas.common import ErrorResponse, Page
from app.schemas.tasks import LabelCount, TaskCreate, TaskRead, TaskUpdate
from app.services import tasks as service
from app.services.tasks import DueFilter, SortOrder, TaskSort

router = APIRouter(tags=["tasks"])
TaskId = Annotated[int, Path(gt=0, description="Task ID")]
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Task not found"}}


@router.get("/api/tasks", response_model=Page[TaskRead], summary="List and filter tasks")
def list_tasks(
    db: DbSession,
    ctx: Ctx,
    q: Annotated[
        str | None, Query(max_length=100, description="Search title and description")
    ] = None,
    status_filter: Annotated[list[TaskStatus] | None, Query(alias="status")] = None,
    priority: Annotated[list[Priority] | None, Query()] = None,
    project_id: Annotated[int | None, Query(gt=0)] = None,
    label: Annotated[str | None, Query(max_length=24)] = None,
    due: Annotated[
        DueFilter | None, Query(description="Deadline window in the viewer's time zone")
    ] = None,
    completed_from: Annotated[
        date | None, Query(description="Completed on or after this local date")
    ] = None,
    completed_to: Annotated[
        date | None, Query(description="Completed on or before this local date")
    ] = None,
    include_archived: bool = False,
    sort: TaskSort = "due_date",
    order: SortOrder | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[TaskRead]:
    tasks, total = service.list_tasks(
        db,
        ctx,
        q=q,
        statuses=status_filter,
        priorities=priority,
        project_id=project_id,
        label=label,
        due=due,
        completed_from=completed_from,
        completed_to=completed_to,
        include_archived=include_archived,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )
    return Page(
        items=[TaskRead.model_validate(task) for task in tasks],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/api/tasks",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ErrorResponse, "description": "Project is archived"},
        422: {"model": ErrorResponse, "description": "Invalid data or unknown project"},
    },
)
def create_task(data: TaskCreate, db: DbSession, ctx: Ctx, response: Response) -> TaskRead:
    task = service.create_task(db, data, ctx=ctx)
    response.headers["Location"] = f"/api/tasks/{task.id}"
    return TaskRead.model_validate(task)


@router.get("/api/tasks/{task_id}", response_model=TaskRead, responses=NOT_FOUND)
def get_task(task_id: TaskId, db: DbSession) -> TaskRead:
    return TaskRead.model_validate(service.get_task(db, task_id))


@router.patch("/api/tasks/{task_id}", response_model=TaskRead, responses=NOT_FOUND)
def update_task(task_id: TaskId, data: TaskUpdate, db: DbSession, ctx: Ctx) -> TaskRead:
    return TaskRead.model_validate(service.update_task(db, task_id, data, ctx=ctx))


@router.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_task(task_id: TaskId, db: DbSession, ctx: Ctx) -> Response:
    service.delete_task(db, task_id, ctx=ctx)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/api/labels", response_model=list[LabelCount], summary="Labels in use, most used first"
)
def list_labels(db: DbSession) -> list[LabelCount]:
    return service.list_labels(db)
