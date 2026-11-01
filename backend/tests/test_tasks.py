"""Task CRUD, lifecycle, Kanban positions, labels, filters and time zones."""

from datetime import UTC, datetime


def test_create_task_with_normalised_labels(client, api):
    project = api.project()
    response = client.post(
        "/api/tasks",
        json={
            "title": "Write tests",
            "project_id": project["id"],
            "priority": "high",
            "due_date": "2026-03-20",
            "labels": ["Backend", " testing ", "backend"],
        },
    )
    assert response.status_code == 201
    task = response.json()
    assert task["labels"] == ["backend", "testing"]
    assert task["status"] == "todo"
    assert task["project"] == {
        "id": project["id"],
        "name": project["name"],
        "color": "indigo",
        "status": "active",
        "is_demo": False,
    }
    assert task["completed_at"] is None


def test_invalid_labels_are_rejected(client, api):
    project = api.project()
    response = client.post(
        "/api/tasks",
        json={"title": "Bad labels", "project_id": project["id"], "labels": ["no spaces allowed"]},
    )
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "labels"
    too_many = client.post(
        "/api/tasks",
        json={"title": "Many", "project_id": project["id"], "labels": [f"l{i}" for i in range(7)]},
    )
    assert too_many.status_code == 422


def test_task_requires_an_existing_project(client):
    response = client.post("/api/tasks", json={"title": "Orphan", "project_id": 9999})
    assert response.status_code == 422
    assert response.json()["errors"] == [
        {"field": "project_id", "message": "Project 9999 does not exist."}
    ]
    missing = client.post("/api/tasks", json={"project_id": 1})
    assert missing.status_code == 422
    assert missing.json()["errors"][0] == {"field": "title", "message": "This field is required."}


def test_archived_projects_do_not_accept_new_tasks(client, api):
    project = api.project(status="archived")
    response = client.post("/api/tasks", json={"title": "Late", "project_id": project["id"]})
    assert response.status_code == 409
    assert "archived" in response.json()["detail"]


def test_status_lifecycle_sets_and_clears_completed_at(client, api, clock):
    project = api.project()
    task = api.task(project["id"])

    done = api.patch_task(task["id"], status="done")
    assert done["status"] == "done"
    assert done["completed_at"] == "2026-03-11T15:00:00Z"

    clock.advance(hours=2)
    reopened = api.patch_task(task["id"], status="in_progress")
    assert reopened["completed_at"] is None

    events = api.activity(entity_type="task", entity_id=task["id"])
    assert [e["event_type"] for e in events] == [
        "task.status_changed",
        "task.completed",
        "task.created",
    ]
    assert events[0]["description"] == f'Moved "{task["title"]}" from Done to In Progress'


def test_creating_a_done_task_sets_completed_at(api):
    project = api.project()
    task = api.task(project["id"], status="done")
    assert task["completed_at"] is not None


def test_update_fields_and_describe_changes(client, api):
    project = api.project()
    task = api.task(project["id"], priority="low")
    api.patch_task(task["id"], priority="urgent")
    event = api.activity(entity_type="task", entity_id=task["id"])[0]
    assert event["description"] == f'Changed priority of "{task["title"]}" from Low to Urgent'

    api.patch_task(task["id"], title="Renamed", due_date="2026-04-02", labels=["docs"])
    event = api.activity(entity_type="task", entity_id=task["id"])[0]
    assert event["event_type"] == "task.updated"
    assert event["description"] == 'Updated title, deadline and labels of "Renamed"'

    cleared = api.patch_task(task["id"], due_date=None, labels=[])
    assert cleared["due_date"] is None
    assert cleared["labels"] == []


def test_patch_rejects_nulls_and_unknown_fields(client, api):
    task = api.task(api.project()["id"])
    assert client.patch(f"/api/tasks/{task['id']}", json={"title": None}).status_code == 422
    assert client.patch(f"/api/tasks/{task['id']}", json={"status": "doing"}).status_code == 422
    assert client.patch(f"/api/tasks/{task['id']}", json={"secret": 1}).status_code == 422
    assert client.patch("/api/tasks/987654", json={"title": "x"}).status_code == 404


def test_move_task_between_projects(client, api):
    first, second = api.project(name="First"), api.project(name="Second")
    task = api.task(first["id"])
    moved = api.patch_task(task["id"], project_id=second["id"])
    assert moved["project"]["name"] == "Second"
    assert client.patch(f"/api/tasks/{task['id']}", json={"project_id": 777}).status_code == 422


def test_kanban_positions(api):
    project = api.project()
    first = api.task(project["id"])
    second = api.task(project["id"])
    assert second["position"] > first["position"]  # new tasks join the end of the column

    review = api.task(project["id"], status="in_review")
    moved = api.patch_task(first["id"], status="in_review")
    assert moved["position"] > review["position"]  # status change appends to the target column

    reordered = api.patch_task(moved["id"], position=review["position"] - 512)
    assert reordered["position"] == review["position"] - 512
    assert reordered["status"] == "in_review"


def test_position_only_change_is_not_logged(api):
    task = api.task(api.project()["id"])
    before = len(api.activity())
    api.patch_task(task["id"], position=12.5)
    assert len(api.activity()) == before


def test_delete_task(client, api):
    task = api.task(api.project()["id"], title="Disposable")
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 204
    assert client.get(f"/api/tasks/{task['id']}").status_code == 404
    event = api.activity()[0]
    assert event["event_type"] == "task.deleted"
    assert event["entity_exists"] is False
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 404


def test_filters_search_and_sorting(client, api):
    project = api.project()
    other = api.project()
    api.task(project["id"], title="Design login page", priority="high", labels=["design"])
    api.task(
        project["id"], title="Login API", description="JWT", priority="urgent", status="in_progress"
    )
    api.task(project["id"], title="Write docs", priority="low", status="done")
    api.task(other["id"], title="Other project task", priority="medium")

    def titles(**params):
        response = client.get("/api/tasks", params=params)
        assert response.status_code == 200, response.text
        return [t["title"] for t in response.json()["items"]]

    assert set(titles(q="login")) == {"Design login page", "Login API"}
    assert titles(q="jwt") == ["Login API"]  # description is searched too
    assert set(titles(status=["todo", "in_progress"], project_id=project["id"])) == {
        "Design login page",
        "Login API",
    }
    assert titles(priority="urgent") == ["Login API"]
    assert titles(label="design") == ["Design login page"]
    assert titles(project_id=other["id"]) == ["Other project task"]
    assert titles(project_id=project["id"], sort="priority") == [
        "Login API",
        "Design login page",
        "Write docs",
    ]
    assert titles(project_id=project["id"], sort="title", order="desc")[0] == "Write docs"


def test_due_date_filters(client, api):
    project = api.project()
    api.task(project["id"], title="Overdue", due_date="2026-03-10")
    done_late = api.task(project["id"], title="Done late", due_date="2026-03-01")
    api.patch_task(done_late["id"], status="done")
    api.task(project["id"], title="Today", due_date="2026-03-11")
    api.task(project["id"], title="Sunday", due_date="2026-03-15")
    api.task(project["id"], title="Next week", due_date="2026-03-16")
    api.task(project["id"], title="Someday")

    def titles(due):
        return [t["title"] for t in client.get("/api/tasks", params={"due": due}).json()["items"]]

    assert titles("overdue") == ["Overdue"]  # completed tasks are never overdue
    assert titles("today") == ["Today"]
    assert titles("this_week") == ["Today", "Sunday"]
    assert titles("upcoming") == ["Today", "Sunday", "Next week"]
    assert titles("no_date") == ["Someday"]
    assert client.get("/api/tasks", params={"due": "soon"}).status_code == 422


def test_completed_date_range_filter(client, api, clock):
    project = api.project()
    early = api.task(project["id"], title="Early")
    late = api.task(project["id"], title="Late")
    clock.set(datetime(2026, 3, 2, 9, 0, tzinfo=UTC))
    api.patch_task(early["id"], status="done")
    clock.set(datetime(2026, 3, 10, 9, 0, tzinfo=UTC))
    api.patch_task(late["id"], status="done")

    response = client.get(
        "/api/tasks", params={"completed_from": "2026-03-09", "completed_to": "2026-03-15"}
    )
    assert [t["title"] for t in response.json()["items"]] == ["Late"]
    invalid = client.get(
        "/api/tasks", params={"completed_from": "2026-03-15", "completed_to": "2026-03-09"}
    )
    assert invalid.status_code == 422


def test_viewer_time_zone_decides_what_today_means(client, api, clock):
    project = api.project()
    api.task(project["id"], title="Due 12 March", due_date="2026-03-12")
    clock.set(datetime(2026, 3, 11, 23, 30, tzinfo=UTC))  # already 12 March in Tokyo

    in_utc = client.get("/api/tasks", params={"due": "today"}).json()["items"]
    in_tokyo = client.get("/api/tasks", params={"due": "today", "tz": "Asia/Tokyo"}).json()["items"]
    assert in_utc == []
    assert [t["title"] for t in in_tokyo] == ["Due 12 March"]

    bad = client.get("/api/tasks", headers={"X-Timezone": "Mars/Olympus"})
    assert bad.status_code == 422
    assert bad.json()["errors"][0]["field"] == "tz"


def test_archived_project_tasks_are_hidden_unless_requested(client, api):
    project = api.project()
    api.task(project["id"], title="Hidden later")
    client.patch(f"/api/projects/{project['id']}", json={"status": "archived"})
    assert client.get("/api/tasks").json()["total"] == 0
    assert client.get("/api/tasks", params={"include_archived": "true"}).json()["total"] == 1
    assert client.get("/api/tasks", params={"project_id": project["id"]}).json()["total"] == 1


def test_pagination(client, api):
    project = api.project()
    for index in range(5):
        api.task(project["id"], title=f"Task {index}")
    page = client.get("/api/tasks", params={"limit": 2, "offset": 2, "sort": "title"}).json()
    assert page["total"] == 5
    assert page["limit"] == 2
    assert page["offset"] == 2
    assert [t["title"] for t in page["items"]] == ["Task 2", "Task 3"]
    assert client.get("/api/tasks", params={"limit": 0}).status_code == 422


def test_labels_endpoint_counts_usage(client, api):
    project = api.project()
    api.task(project["id"], labels=["frontend", "bug"])
    api.task(project["id"], labels=["frontend"])
    assert client.get("/api/labels").json() == [
        {"name": "frontend", "count": 2},
        {"name": "bug", "count": 1},
    ]
