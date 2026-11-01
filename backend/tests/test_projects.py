"""Project CRUD, validation, calculated progress, archiving and safe deletion."""


def test_create_project_returns_created_resource(client):
    response = client.post(
        "/api/projects",
        json={
            "name": "  Capstone Tracker  ",
            "description": "Final year project",
            "status": "active",
            "color": "violet",
            "owner": "Ada",
            "start_date": "2026-03-01",
            "due_date": "2026-05-01",
        },
    )
    assert response.status_code == 201
    assert response.headers["location"].endswith(f"/api/projects/{response.json()['id']}")
    project = response.json()
    assert project["name"] == "Capstone Tracker"  # whitespace trimmed
    assert project["status"] == "active"
    assert project["color"] == "violet"
    assert project["task_count"] == 0
    assert project["progress"] == 0
    assert project["is_demo"] is False
    assert project["created_at"].endswith("Z")


def test_create_project_applies_defaults(client):
    project = client.post("/api/projects", json={"name": "Defaults"}).json()
    assert project["status"] == "planning"
    assert project["color"] == "indigo"
    assert project["owner"] is None
    assert project["description"] == ""


def test_create_project_validates_input(client):
    response = client.post("/api/projects", json={"name": " ", "color": "neon", "extra": 1})
    assert response.status_code == 422
    body = response.json()
    fields = {error["field"] for error in body["errors"]}
    assert {"name", "color", "extra"} <= fields
    assert body["detail"].startswith("Name:")


def test_deadline_cannot_be_before_start(client, api):
    response = client.post(
        "/api/projects",
        json={"name": "Backwards", "start_date": "2026-04-10", "due_date": "2026-04-01"},
    )
    assert response.status_code == 422
    assert response.json()["errors"][0] == {
        "field": "due_date",
        "message": "Deadline must be on or after the start date.",
    }

    # PATCH validates against the values already stored.
    project = api.project(start_date="2026-04-10")
    patch = client.patch(f"/api/projects/{project['id']}", json={"due_date": "2026-04-01"})
    assert patch.status_code == 422
    assert patch.json()["errors"][0]["field"] == "due_date"


def test_project_names_are_unique_ignoring_case(client, api):
    api.project(name="Robotics Club")
    duplicate = client.post("/api/projects", json={"name": "robotics club"})
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "conflict"
    assert duplicate.json()["errors"][0]["field"] == "name"

    other = api.project(name="Chess Club")
    rename = client.patch(f"/api/projects/{other['id']}", json={"name": "ROBOTICS CLUB"})
    assert rename.status_code == 409


def test_get_missing_project_returns_404(client):
    response = client.get("/api/projects/424242")
    assert response.status_code == 404
    assert response.json() == {
        "detail": "Project 424242 was not found.",
        "code": "not_found",
        "errors": [],
    }
    assert client.get("/api/projects/abc").status_code == 422


def test_update_project_fields_and_records_activity(client, api):
    project = api.project(name="Old name")
    response = client.patch(
        f"/api/projects/{project['id']}",
        json={"name": "New name", "description": "Now with details", "owner": ""},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "New name"
    assert updated["description"] == "Now with details"
    assert updated["owner"] is None
    events = api.activity(entity_type="project", entity_id=project["id"])
    assert events[0]["event_type"] == "project.updated"
    assert (
        events[0]["description"]
        == 'Renamed project "Old name" to "New name" and updated description'
    )


def test_patch_rejects_null_for_required_fields(client, api):
    project = api.project()
    response = client.patch(f"/api/projects/{project['id']}", json={"name": None})
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "name"


def test_noop_patch_does_not_create_activity(client, api):
    project = api.project(name="Stable")
    before = len(api.activity())
    response = client.patch(f"/api/projects/{project['id']}", json={"name": "Stable"})
    assert response.status_code == 200
    assert len(api.activity()) == before


def test_progress_is_calculated_from_tasks(client, api):
    project = api.project()
    tasks = [api.task(project["id"]) for _ in range(3)]
    api.patch_task(tasks[0]["id"], status="done")
    fetched = client.get(f"/api/projects/{project['id']}").json()
    assert fetched["task_count"] == 3
    assert fetched["completed_task_count"] == 1
    assert fetched["open_task_count"] == 2
    assert fetched["progress"] == 33  # floored, never rounds up to look finished

    for task in tasks[1:]:
        api.patch_task(task["id"], status="done")
    assert client.get(f"/api/projects/{project['id']}").json()["progress"] == 100


def test_overdue_and_open_issue_counts(client, api):
    project = api.project()
    api.task(project["id"], due_date="2026-03-01")  # before FIXED_NOW (2026-03-11)
    done = api.task(project["id"], due_date="2026-03-01")
    api.patch_task(done["id"], status="done")
    api.task(project["id"], due_date="2026-04-01")
    api.issue(project["id"])
    closed = api.issue(project["id"])
    client.patch(f"/api/issues/{closed['id']}", json={"status": "closed"})

    fetched = client.get(f"/api/projects/{project['id']}").json()
    assert fetched["overdue_task_count"] == 1
    assert fetched["open_issue_count"] == 1


def test_list_search_filter_and_sort(client, api):
    api.project(name="Alpha robotics", status="active", due_date="2026-06-01")
    api.project(name="Beta website", status="planning", description="Robotics outreach page")
    api.project(name="Gamma archive", status="archived")

    listed = client.get("/api/projects").json()
    names = [p["name"] for p in listed["items"]]
    assert "Gamma archive" not in names  # archived projects are hidden by default
    assert listed["total"] == 2

    search = client.get("/api/projects", params={"q": "ROBOTICS"}).json()
    assert {p["name"] for p in search["items"]} == {"Alpha robotics", "Beta website"}

    archived = client.get("/api/projects", params={"status": "archived"}).json()
    assert [p["name"] for p in archived["items"]] == ["Gamma archive"]

    everything = client.get("/api/projects", params={"include_archived": "true"}).json()
    assert everything["total"] == 3

    by_name = client.get("/api/projects", params={"sort": "name", "order": "desc"}).json()
    assert [p["name"] for p in by_name["items"]] == ["Beta website", "Alpha robotics"]

    by_deadline = client.get("/api/projects", params={"sort": "due_date"}).json()
    assert by_deadline["items"][0]["name"] == "Alpha robotics"  # null deadlines last


def test_sort_by_progress(client, api):
    slow = api.project(name="Slow")
    fast = api.project(name="Fast")
    api.task(slow["id"])
    finished = api.task(fast["id"])
    api.patch_task(finished["id"], status="done")
    items = client.get("/api/projects", params={"sort": "progress"}).json()["items"]
    assert [p["name"] for p in items] == ["Fast", "Slow"]


def test_search_escapes_like_wildcards(client, api):
    api.project(name="Plain name")
    assert client.get("/api/projects", params={"q": "%"}).json()["total"] == 0
    assert client.get("/api/projects", params={"q": "_"}).json()["total"] == 0


def test_archive_and_restore_record_activity(client, api):
    project = api.project(name="Seasonal")
    archived = client.patch(f"/api/projects/{project['id']}", json={"status": "archived"})
    assert archived.json()["status"] == "archived"
    restored = client.patch(f"/api/projects/{project['id']}", json={"status": "active"})
    assert restored.json()["status"] == "active"
    events = [e["event_type"] for e in api.activity(entity_type="project", entity_id=project["id"])]
    assert events[:2] == ["project.restored", "project.archived"]


def test_status_change_is_described(client, api):
    project = api.project(status="planning")
    client.patch(f"/api/projects/{project['id']}", json={"status": "on_hold"})
    event = api.activity(entity_type="project", entity_id=project["id"])[0]
    assert event["event_type"] == "project.status_changed"
    assert event["description"].endswith("from Planning to On Hold")
    assert event["details"] == {"changes": {"status": {"from": "planning", "to": "on_hold"}}}


def test_delete_project_cascades_and_keeps_history(client, api):
    project = api.project(name="Short lived")
    task = api.task(project["id"], labels=["backend"])
    issue = api.issue(project["id"])

    response = client.delete(f"/api/projects/{project['id']}")
    assert response.status_code == 204
    assert response.content == b""

    assert client.get(f"/api/projects/{project['id']}").status_code == 404
    assert client.get(f"/api/tasks/{task['id']}").status_code == 404
    assert client.get(f"/api/issues/{issue['id']}").status_code == 404
    assert client.get("/api/labels").json() == []  # labels removed with their task
    assert client.delete(f"/api/projects/{project['id']}").status_code == 404

    events = api.activity()
    assert events[0]["event_type"] == "project.deleted"
    assert events[0]["description"] == 'Deleted project "Short lived" with 1 task and 1 issue'
    assert events[0]["entity_exists"] is False
    # Older events stay in the log but no longer link to the deleted project.
    created = next(e for e in events if e["event_type"] == "project.created")
    assert created["project_id"] is None
    assert created["project"] is None
