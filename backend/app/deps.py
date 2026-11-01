"""Reusable FastAPI dependencies."""

from datetime import datetime
from typing import Annotated

from fastapi import Depends, Header, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.enums import WeekStart
from app.errors import ValidationFailed
from app.services.misc import get_preferences
from app.time_utils import TimeContext, parse_timezone

DbSession = Annotated[Session, Depends(get_db)]


def get_now(request: Request) -> datetime:
    # The clock lives on app.state so tests can freeze time without patching globals.
    return request.app.state.clock()


Now = Annotated[datetime, Depends(get_now)]


def get_time_context(
    db: DbSession,
    now: Now,
    tz: Annotated[
        str | None,
        Query(
            max_length=64,
            description=(
                "IANA time zone such as Europe/London. Defaults to the X-Timezone header, then UTC."
            ),
        ),
    ] = None,
    x_timezone: Annotated[str | None, Header(max_length=64)] = None,
) -> TimeContext:
    try:
        zone = parse_timezone(tz or x_timezone)
    except ValueError as exc:
        raise ValidationFailed(str(exc), field="tz") from exc
    week_start = WeekStart(get_preferences(db).week_start)
    return TimeContext(now=now, tz=zone, week_start=week_start)


Ctx = Annotated[TimeContext, Depends(get_time_context)]
