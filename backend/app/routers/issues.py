from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.deps import Ctx, DbSession
from app.enums import IssueStatus, IssueType, Priority
from app.schemas.common import ErrorResponse, Page
from app.schemas.issues import IssueCreate, IssueRead, IssueSummary, IssueUpdate
from app.services import issues as service
from app.services.issues import IssueSort, SortOrder

router = APIRouter(prefix="/api/issues", tags=["issues"])
IssueId = Annotated[int, Path(gt=0, description="Issue ID")]
NOT_FOUND = {404: {"model": ErrorResponse, "description": "Issue not found"}}


@router.get("", response_model=Page[IssueRead], summary="List and filter issues")
def list_issues(
    db: DbSession,
    q: Annotated[str | None, Query(max_length=100)] = None,
    status_filter: Annotated[list[IssueStatus] | None, Query(alias="status")] = None,
    type_filter: Annotated[list[IssueType] | None, Query(alias="type")] = None,
    priority: Annotated[list[Priority] | None, Query()] = None,
    project_id: Annotated[int | None, Query(gt=0)] = None,
    include_archived: bool = False,
    sort: IssueSort = "created_at",
    order: SortOrder | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[IssueRead]:
    issues, total = service.list_issues(
        db,
        q=q,
        statuses=status_filter,
        types=type_filter,
        priorities=priority,
        project_id=project_id,
        include_archived=include_archived,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )
    return Page(
        items=[IssueRead.model_validate(issue) for issue in issues],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/summary", response_model=IssueSummary, summary="Issue counts by status and type")
def issue_summary(
    db: DbSession, project_id: Annotated[int | None, Query(gt=0)] = None
) -> IssueSummary:
    return service.issue_summary(db, project_id=project_id)


@router.post(
    "",
    response_model=IssueRead,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def create_issue(data: IssueCreate, db: DbSession, ctx: Ctx, response: Response) -> IssueRead:
    issue = service.create_issue(db, data, ctx=ctx)
    response.headers["Location"] = f"/api/issues/{issue.id}"
    return IssueRead.model_validate(issue)


@router.get("/{issue_id}", response_model=IssueRead, responses=NOT_FOUND)
def get_issue(issue_id: IssueId, db: DbSession) -> IssueRead:
    return IssueRead.model_validate(service.get_issue(db, issue_id))


@router.patch("/{issue_id}", response_model=IssueRead, responses=NOT_FOUND)
def update_issue(issue_id: IssueId, data: IssueUpdate, db: DbSession, ctx: Ctx) -> IssueRead:
    return IssueRead.model_validate(service.update_issue(db, issue_id, data, ctx=ctx))


@router.delete("/{issue_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_issue(issue_id: IssueId, db: DbSession, ctx: Ctx) -> Response:
    service.delete_issue(db, issue_id, ctx=ctx)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
