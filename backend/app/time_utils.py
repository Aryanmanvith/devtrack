"""Date and time helpers.

Timestamps are stored in UTC. Calendar questions such as "is this task overdue?" or
"what counts as this week?" are answered in the viewer's own time zone, which the
frontend sends with every request (X-Timezone header or ?tz= query parameter).
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.enums import WeekStart


def utcnow() -> datetime:
    return datetime.now(UTC)


def parse_timezone(name: str | None) -> ZoneInfo:
    key = (name or "").strip() or "UTC"
    try:
        return ZoneInfo(key)
    except (ZoneInfoNotFoundError, ValueError, TypeError, OSError) as exc:
        raise ValueError(
            f"Unknown time zone '{key}'. Use an IANA name such as Europe/London."
        ) from exc


def week_bounds(day: date, week_start: WeekStart) -> tuple[date, date]:
    """Return the first and last calendar day of the week containing ``day``."""
    offset = day.weekday() if week_start == WeekStart.MONDAY else (day.weekday() + 1) % 7
    start = day - timedelta(days=offset)
    return start, start + timedelta(days=6)


def day_start_utc(day: date, tz: tzinfo) -> datetime:
    """The UTC instant at which ``day`` begins in ``tz`` (DST-aware)."""
    return datetime.combine(day, time.min, tzinfo=tz).astimezone(UTC)


@dataclass(frozen=True)
class TimeContext:
    """Everything a service needs to answer calendar questions for one request."""

    now: datetime
    tz: tzinfo
    week_start: WeekStart = WeekStart.MONDAY

    @property
    def today(self) -> date:
        return self.now.astimezone(self.tz).date()

    @property
    def week(self) -> tuple[date, date]:
        return week_bounds(self.today, self.week_start)

    @property
    def timezone_name(self) -> str:
        return getattr(self.tz, "key", None) or str(self.tz)

    def day_start(self, day: date) -> datetime:
        return day_start_utc(day, self.tz)

    def day_range(self, first: date, last: date) -> tuple[datetime, datetime]:
        """UTC bounds [start, end) covering the local days ``first`` through ``last``."""
        return self.day_start(first), self.day_start(last + timedelta(days=1))

    def local_date(self, moment: datetime) -> date:
        return moment.astimezone(self.tz).date()
