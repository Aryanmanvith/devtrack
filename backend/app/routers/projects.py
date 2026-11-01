from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.deps import Ctx, DbSession
from app.enums import ProjectStatus
from app.schemas.common import ErrorResponse, Page
from app.schemas.projects import ProjectCreate, ProjectRead, ProjectUpdate
from app.services import projects as service
from app.services.projects import ProjectSort, SortOrder

router = APIRouter(prefix="/api/projects", tags=["projects"])
ProjectId = Annotated[int, Path(gt=0, description="Project ID")]
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Project not found"}}


@router.get("", response_model=Page[ProjectRead], summary="List projects with calculated progress")
def list_projects(
    db: DbSession,
    ctx: Ctx,
    q: Annotated[
        str | None, Query(max_length=100, description="Search name, description or owner")
    ] = None,
    status_filter: Annotated[
        list[ProjectStatus] | None,
        Query(alias="status", description="Repeat to match several statuses"),
    ] = None,
    include_archived: bool = False,
    sort: ProjectSort = "updated_at",
    order: SortOrder | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[ProjectRead]:
    items, total = service.list_projects(
        db,
        today=ctx.today,
        q=q,
        statuses=status_filter,
        include_archived=include_archived,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse, "description": "Duplicate project name"}},
)
def create_project(data: ProjectCreate, db: DbSession, ctx: Ctx, response: Response) -> ProjectRead:
    project = service.create_project(db, data, now=ctx.now)
    response.headers["Location"] = f"/api/projects/{project.id}"
    return service.get_project(db, project.id, today=ctx.today)


@router.get("/{project_id}", response_model=ProjectRead, responses=NOT_FOUND)
def get_project(project_id: ProjectId, db: DbSession, ctx: Ctx) -> ProjectRead:
    return service.get_project(db, project_id, today=ctx.today)


@router.patch(
    "/{project_id}",
    response_model=ProjectRead,
    responses={**NOT_FOUND, 409: {"model": ErrorResponse, "description": "Duplicate project name"}},
)
def update_project(
    project_id: ProjectId, data: ProjectUpdate, db: DbSession, ctx: Ctx
) -> ProjectRead:
    service.update_project(db, project_id, data, now=ctx.now)
    return service.get_project(db, project_id, today=ctx.today)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=NOT_FOUND,
    summary="Delete a project together with its tasks and issues",
)
def delete_project(project_id: ProjectId, db: DbSession, ctx: Ctx) -> Response:
    service.delete_project(db, project_id, now=ctx.now)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
