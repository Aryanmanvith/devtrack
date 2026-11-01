"""First-run initialisation."""

import logging
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Project, UserPreferences
from app.services.demo import seed_demo
from app.time_utils import TimeContext

logger = logging.getLogger("devtrack")


def initialize_workspace(db: Session, *, seed_demo_data: bool, now: datetime) -> bool:
    """Create the preferences row on first run and, if enabled, load demo data once.

    The preferences row doubles as a "workspace initialised" marker, so demo data is never
    re-created on later startups, even after the user removes it. Returns True if seeded.
    """
    if db.scalar(select(func.count(UserPreferences.id))):
        return False
    db.add(UserPreferences(created_at=now, updated_at=now))
    seeded = False
    if seed_demo_data and not db.scalar(select(func.count(Project.id))):
        local_zone = datetime.now().astimezone().tzinfo
        assert local_zone is not None
        seed_demo(db, TimeContext(now=now, tz=local_zone), commit=False)
        seeded = True
        logger.info("Loaded the demo workspace on first run.")
    db.commit()
    return seeded
