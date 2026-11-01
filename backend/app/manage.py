"""Maintenance commands.

Usage (from the backend/ folder):

    python -m app.manage init-db          # create/upgrade the schema (first run seeds demo data)
    python -m app.manage seed-demo        # load the demo workspace if it is not loaded
    python -m app.manage seed-demo --reset
    python -m app.manage remove-demo      # delete demo projects and everything inside them
"""

import argparse
import sys
from datetime import datetime

from app.bootstrap import initialize_workspace
from app.config import get_settings
from app.database import create_db_engine, create_session_factory
from app.db_migrations import run_migrations
from app.errors import ConflictError
from app.services.demo import demo_status, remove_demo, seed_demo
from app.time_utils import TimeContext, utcnow


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.manage", description="DevTrack maintenance"
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-db", help="Create or upgrade the database schema.")
    seed = commands.add_parser("seed-demo", help="Load the demo workspace.")
    seed.add_argument("--reset", action="store_true", help="Remove existing demo data first.")
    commands.add_parser("remove-demo", help="Delete all demo projects, tasks and issues.")
    args = parser.parse_args(argv)

    settings = get_settings()
    engine = create_db_engine(settings.database_url)
    run_migrations(engine)
    session_factory = create_session_factory(engine)
    print(f"Database: {settings.database_url}")

    with session_factory() as db:
        if args.command == "init-db":
            seeded = initialize_workspace(db, seed_demo_data=settings.seed_demo_data, now=utcnow())
            print("Schema is up to date." + (" Demo workspace loaded." if seeded else ""))
        elif args.command == "seed-demo":
            if args.reset and demo_status(db).has_demo_data:
                removed = remove_demo(db, now=utcnow())
                print(f"Removed {removed.removed_projects} demo projects.")
            local_zone = datetime.now().astimezone().tzinfo
            assert local_zone is not None
            try:
                status = seed_demo(db, TimeContext(now=utcnow(), tz=local_zone))
            except ConflictError as exc:
                print(exc.message)
                return 1
            print(
                f"Loaded {status.projects} projects, {status.tasks} tasks "
                f"and {status.issues} issues."
            )
        elif args.command == "remove-demo":
            removed = remove_demo(db, now=utcnow())
            print(
                f"Removed {removed.removed_projects} projects, {removed.removed_tasks} tasks "
                f"and {removed.removed_issues} issues."
            )
    engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(main())
