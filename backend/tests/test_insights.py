"""Dashboard, analytics, activity feed, search, preferences and demo data."""

from datetime import UTC, datetime


def _summary(client, **params):
    response = client.get("/api/dashboard/summary", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_empty_workspace_has_zero_metrics(client):
    summary = _summary(client)
    for key in (
        "active_projects",
        "open_tasks",
        "completed_this_week",
        "overdue_tasks",
        "open_issues",
    ):
        assert summary[key] == 0
    distribution = client.get("/api/dashboard/task-distribution").json()
    assert distribution["total"] == 0
    assert all(item["count"] == 0 for item in distribution["by_status"])
    analytics = client.get("/api/analytics/overview").json()
    assert analytics["completion_rate"] == 0
    assert analytics["avg_cycle_days"] is None


def test_summary_matches_known_records(client, api, clock):
    active = api.project(status="active")
    api.project(status="planning")
    archived = api.project(status="active")

    clock.set(datetime(2026, 2, 20, 9, 0, tzinfo=UTC))
    last_week = api.task(active["id"], title="Finished last week")
    this_week = api.task(active["id"], title="Finished this week")
    api.task(active["id"], title="Overdue", due_date="2026-03-05", status="in_progress")
    api.task(active["id"], title="Due today", due_date="2026-03-11")
    api.task(active["id"], title="Due Sunday", due_date="2026-03-15")
    api.task(archived["id"], title="Hidden overdue", due_date="2026-03-01")
    api.issue(active["id"])

    clock.set(datetime(2026, 3, 4, 12, 0, tzinfo=UTC))
    api.patch_task(last_week["id"], status="done")
    clock.set(datetime(2026, 3, 10, 12, 0, tzinfo=UTC))
    api.patch_task(this_week["id"], status="done")
    client.patch(f"/api/projects/{archived['id']}", json={"status": "archived"})
    clock.set(datetime(2026, 3, 11, 15, 0, tzinfo=UTC))

    summary = _summary(client)
    assert summary["week_start"] == "2026-03-09"
    assert summary["week_end"] == "2026-03-15"
    assert summary["active_projects"] == 1
    assert summary["total_projects"] == 2  # archived projects are excluded
    assert summary["total_tasks"] == 5
    assert summary["open_tasks"] == 3
    assert summary["in_progress_tasks"] == 1
    assert summary["completed_this_week"] == 1
    assert summary["completed_last_week"] == 1
    assert summary["overdue_tasks"] == 1
    assert summary["due_today"] == 1
    assert summary["due_this_week"] == 2
    assert summary["open_issues"] == 1


def test_week_start_preference_changes_week_boundaries(client):
    client.patch("/api/preferences", json={"week_start": "sunday"})
    summary = _summary(client)
    assert summary["week_start"] == "2026-03-08"
    assert summary["week_end"] == "2026-03-14"


def test_completed_this_week_uses_the_viewer_time_zone(client, api, clock):
    task = api.task(api.project()["id"])
    clock.set(datetime(2026, 3, 8, 23, 30, tzinfo=UTC))  # Sunday night UTC = Monday in Berlin
    api.patch_task(task["id"], status="done")
    clock.set(datetime(2026, 3, 11, 15, 0, tzinfo=UTC))
    assert _summary(client)["completed_this_week"] == 0
    assert _summary(client, tz="Europe/Berlin")["completed_this_week"] == 1


def test_completion_trend_buckets_by_week(client, api, clock):
    project = api.project()
    clock.set(datetime(2026, 2, 18, 9, 0, tzinfo=UTC))
    first, second, _third = (api.task(project["id"]) for _ in range(3))
    clock.set(datetime(2026, 3, 3, 9, 0, tzinfo=UTC))
    api.patch_task(first["id"], status="done")
    clock.set(datetime(2026, 3, 10, 9, 0, tzinfo=UTC))
    api.patch_task(second["id"], status="done")
    clock.set(datetime(2026, 3, 11, 15, 0, tzinfo=UTC))

    trend = client.get("/api/dashboard/completion-trend", params={"weeks": 4}).json()
    points = [
        (p["week_start"], p["created"], p["completed"], p["remaining"]) for p in trend["points"]
    ]
    assert points == [
        ("2026-02-16", 3, 0, 3),
        ("2026-02-23", 0, 0, 3),
        ("2026-03-02", 0, 1, 2),
        ("2026-03-09", 0, 1, 1),
    ]
    assert client.get("/api/dashboard/completion-trend", params={"weeks": 1}).status_code == 422


def test_task_distribution(client, api):
    project = api.project()
    api.task(project["id"], status="backlog", priority="low")
    api.task(project["id"], status="in_progress", priority="urgent")
    api.task(project["id"], status="done", priority="urgent")
    distribution = client.get("/api/dashboard/task-distribution").json()
    by_status = {item["key"]: item["count"] for item in distribution["by_status"]}
    by_priority = {item["key"]: item["count"] for item in distribution["by_priority"]}
    assert by_status == {"backlog": 1, "todo": 0, "in_progress": 1, "in_review": 0, "done": 1}
    assert by_priority == {"urgent": 1, "high": 0, "medium": 0, "low": 1}  # open tasks only
    assert distribution["open_total"] == 2


def test_upcoming_deadlines(client, api):
    project = api.project()
    api.task(project["id"], title="Late", due_date="2026-03-09")
    api.task(project["id"], title="Soon", due_date="2026-03-13", priority="urgent")
    api.task(project["id"], title="Soon too", due_date="2026-03-13", priority="low")
    api.task(project["id"], title="Far away", due_date="2026-05-01")
    finished = api.task(project["id"], title="Finished", due_date="2026-03-12")
    api.patch_task(finished["id"], status="done")

    data = client.get("/api/dashboard/upcoming-deadlines", params={"days": 7}).json()
    assert [(i["title"], i["days_until"], i["is_overdue"]) for i in data["items"]] == [
        ("Late", -2, True),
        ("Soon", 2, False),
        ("Soon too", 2, False),
    ]
    assert data["overdue_count"] == 1
    assert data["upcoming_count"] == 2


def test_analytics_overview_respects_filters(client, api, clock):
    focus = api.project(name="Focus")
    other = api.project(name="Other")
    clock.set(datetime(2026, 1, 5, 9, 0, tzinfo=UTC))
    old = api.task(focus["id"])
    clock.set(datetime(2026, 1, 7, 9, 0, tzinfo=UTC))
    api.patch_task(old["id"], status="done")  # completed long before the default range
    clock.set(datetime(2026, 3, 8, 9, 0, tzinfo=UTC))
    recent = api.task(focus["id"])
    api.task(focus["id"], due_date="2026-03-01")
    api.task(other["id"])
    clock.set(datetime(2026, 3, 10, 9, 0, tzinfo=UTC))
    api.patch_task(recent["id"], status="done")
    bug = api.issue(focus["id"], type="bug")
    client.patch(f"/api/issues/{bug['id']}", json={"status": "resolved"})
    api.issue(other["id"], type="feature")
    clock.set(datetime(2026, 3, 11, 15, 0, tzinfo=UTC))

    everything = client.get("/api/analytics/overview").json()
    assert everything["total_tasks"] == 4
    assert everything["completed_tasks"] == 2
    assert everything["completion_rate"] == 50.0

    focused = client.get(
        "/api/analytics/overview", params={"project_id": focus["id"], "weeks": 4}
    ).json()
    assert focused["total_tasks"] == 3
    assert focused["overdue_tasks"] == 1
    assert focused["completed_in_range"] == 1
    assert focused["avg_cycle_days"] == 2.0
    assert focused["range_start"] == "2026-02-16"
    assert focused["resolved_issues_in_range"] == 1
    assert {i["type"]: (i["open"], i["closed"]) for i in focused["issues_by_type"]}["bug"] == (0, 1)
    assert [p["project"]["name"] for p in focused["project_progress"]] == ["Focus"]
    daily = {d["date"]: d["count"] for d in focused["daily_completions"]}
    assert daily["2026-03-10"] == 1
    assert len(focused["daily_completions"]) == 28

    longer = client.get(
        "/api/analytics/overview", params={"project_id": focus["id"], "weeks": 12}
    ).json()
    assert longer["completed_in_range"] == 2  # the wider range now includes January

    missing = client.get("/api/analytics/overview", params={"project_id": 99999})
    assert missing.status_code == 404


def test_activity_feed_filters_and_pages(client, api):
    first = api.project(name="First")
    second = api.project(name="Second")
    task = api.task(first["id"], title="Feed me")
    api.patch_task(task["id"], status="done")
    api.issue(second["id"], title="Issue in second")

    everything = client.get("/api/activity").json()
    assert everything["total"] == 5
    assert everything["items"][0]["event_type"] == "issue.created"  # newest first
    assert everything["items"][0]["entity_exists"] is True
    assert everything["items"][0]["project"]["name"] == "Second"

    tasks_only = client.get("/api/activity", params={"entity_type": "task"}).json()
    assert [e["event_type"] for e in tasks_only["items"]] == ["task.completed", "task.created"]
    in_first = client.get("/api/activity", params={"project_id": first["id"]}).json()
    assert in_first["total"] == 3
    searched = client.get("/api/activity", params={"q": "feed me"}).json()
    assert searched["total"] == 2
    page = client.get("/api/activity", params={"limit": 2, "offset": 2}).json()
    assert len(page["items"]) == 2
    assert page["total"] == 5


def test_global_search(client, api):
    project = api.project(name="Telescope app", description="Astronomy club")
    api.task(project["id"], title="Calibrate telescope mount")
    api.issue(project["id"], title="Telescope list is empty")
    results = client.get("/api/search", params={"q": "telescope"}).json()
    assert [p["name"] for p in results["projects"]] == ["Telescope app"]
    assert [t["title"] for t in results["tasks"]] == ["Calibrate telescope mount"]
    assert [i["title"] for i in results["issues"]] == ["Telescope list is empty"]
    assert client.get("/api/search", params={"q": ""}).status_code == 422


def test_preferences_persist_and_validate(client, make_client):
    defaults = client.get("/api/preferences").json()
    assert defaults["display_name"] == "Student"
    assert defaults["theme"] == "dark"

    updated = client.patch(
        "/api/preferences", json={"display_name": "  Ada Lovelace ", "theme": "light"}
    ).json()
    assert updated["display_name"] == "Ada Lovelace"
    assert updated["theme"] == "light"

    assert client.patch("/api/preferences", json={"display_name": ""}).status_code == 422
    assert client.patch("/api/preferences", json={"theme": "neon"}).status_code == 422
    assert client.patch("/api/preferences", json={"theme": None}).status_code == 422

    with make_client() as restarted:
        assert restarted.get("/api/preferences").json()["display_name"] == "Ada Lovelace"


def test_demo_data_is_seeded_once_and_clearly_flagged(make_client):
    with make_client(seed_demo_data=True) as client:
        status = client.get("/api/demo-data").json()
        assert status["has_demo_data"] is True
        assert status["projects"] == 4
        projects = client.get("/api/projects").json()["items"]
        assert all(project["is_demo"] for project in projects)
        tasks = client.get("/api/tasks", params={"limit": 500}).json()["items"]
        assert all(task["is_demo"] for task in tasks)
        assert all((t["status"] == "done") == (t["completed_at"] is not None) for t in tasks)
        # Only one truthful activity entry is written for the seed.
        activity = client.get("/api/activity").json()
        assert activity["total"] == 1
        assert activity["items"][0]["event_type"] == "demo.seeded"

    with make_client(seed_demo_data=True) as restarted:
        assert restarted.get("/api/demo-data").json()["projects"] == 4  # no duplicates


def test_remove_and_reload_demo_data(make_client):
    with make_client(seed_demo_data=True) as client:
        demo_project = client.get("/api/projects").json()["items"][0]
        own = client.post("/api/projects", json={"name": "My real project"}).json()
        client.post("/api/tasks", json={"title": "Mine", "project_id": demo_project["id"]})
        client.post("/api/tasks", json={"title": "Keep", "project_id": own["id"]})

        status = client.get("/api/demo-data").json()
        assert status["user_tasks_in_demo_projects"] == 1  # surfaced so the UI can warn

        removal = client.delete("/api/demo-data").json()
        assert removal["removed_projects"] == 4
        assert client.get("/api/demo-data").json()["has_demo_data"] is False
        remaining = client.get("/api/projects").json()["items"]
        assert [p["name"] for p in remaining] == ["My real project"]
        assert [t["title"] for t in client.get("/api/tasks").json()["items"]] == ["Keep"]

        reloaded = client.post("/api/demo-data")
        assert reloaded.status_code == 201
        assert reloaded.json()["projects"] == 4
        assert client.post("/api/demo-data").status_code == 409

    with make_client(seed_demo_data=True) as restarted:
        # Removing demo data must not cause it to be re-seeded on the next startup.
        restarted.delete("/api/demo-data")
    with make_client(seed_demo_data=True) as again:
        assert again.get("/api/demo-data").json()["has_demo_data"] is False
