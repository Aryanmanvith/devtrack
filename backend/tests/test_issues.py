"""Issue CRUD, resolution lifecycle, filters and summary counts."""


def test_create_issue(client, api):
    project = api.project(name="Website")
    response = client.post(
        "/api/issues",
        json={
            "title": "Login button unresponsive",
            "project_id": project["id"],
            "type": "bug",
            "priority": "high",
        },
    )
    assert response.status_code == 201
    issue = response.json()
    assert issue["status"] == "open"
    assert issue["resolved_at"] is None
    event = api.activity(entity_type="issue", entity_id=issue["id"])[0]
    assert event["description"] == 'Opened bug "Login button unresponsive" in Website'


def test_issue_validation(client, api):
    project = api.project()
    response = client.post(
        "/api/issues", json={"title": "", "project_id": project["id"], "type": "rant"}
    )
    assert response.status_code == 422
    assert {e["field"] for e in response.json()["errors"]} == {"title", "type"}
    orphan = client.post("/api/issues", json={"title": "x", "project_id": 4040})
    assert orphan.status_code == 422
    assert orphan.json()["errors"][0]["field"] == "project_id"


def test_resolve_close_and_reopen(client, api, clock):
    issue = api.issue(api.project()["id"], type="feature")

    resolved = client.patch(f"/api/issues/{issue['id']}", json={"status": "resolved"}).json()
    assert resolved["status"] == "resolved"
    assert resolved["resolved_at"] == "2026-03-11T15:00:00Z"

    clock.advance(hours=1)
    closed = client.patch(f"/api/issues/{issue['id']}", json={"status": "closed"}).json()
    assert closed["resolved_at"] == "2026-03-11T15:00:00Z"  # keeps the original resolution time

    reopened = client.patch(f"/api/issues/{issue['id']}", json={"status": "open"}).json()
    assert reopened["resolved_at"] is None

    events = api.activity(entity_type="issue", entity_id=issue["id"])
    assert [e["event_type"] for e in events] == [
        "issue.reopened",
        "issue.closed",
        "issue.resolved",
        "issue.created",
    ]
    assert events[0]["description"] == f'Reopened feature request "{issue["title"]}"'


def test_priority_change_is_logged(client, api):
    issue = api.issue(api.project()["id"], priority="medium")
    response = client.patch(f"/api/issues/{issue['id']}", json={"priority": "urgent"})
    assert response.json()["priority"] == "urgent"
    event = api.activity(entity_type="issue", entity_id=issue["id"])[0]
    assert (
        event["description"] == f'Changed priority of bug "{issue["title"]}" from Medium to Urgent'
    )


def test_filters_search_and_summary(client, api):
    project = api.project()
    other = api.project()
    api.issue(project["id"], title="Crash on save", type="bug", priority="urgent")
    api.issue(project["id"], title="Add export", type="feature", description="CSV download")
    done = api.issue(project["id"], title="Old bug", type="bug")
    client.patch(f"/api/issues/{done['id']}", json={"status": "resolved"})
    api.issue(other["id"], title="Elsewhere", type="question")

    def titles(**params):
        return [i["title"] for i in client.get("/api/issues", params=params).json()["items"]]

    assert set(titles(status=["open", "in_progress"], project_id=project["id"])) == {
        "Crash on save",
        "Add export",
    }
    assert set(titles(type="bug")) == {"Crash on save", "Old bug"}
    assert titles(q="csv") == ["Add export"]
    assert titles(priority="urgent") == ["Crash on save"]
    assert titles(project_id=project["id"], sort="title")[0] == "Add export"

    summary = client.get("/api/issues/summary", params={"project_id": project["id"]}).json()
    assert summary["total"] == 3
    assert summary["open"] == 2
    assert summary["closed"] == 1
    assert {i["key"]: i["count"] for i in summary["by_type"]}["bug"] == 2


def test_delete_issue(client, api):
    issue = api.issue(api.project()["id"])
    assert client.delete(f"/api/issues/{issue['id']}").status_code == 204
    assert client.get(f"/api/issues/{issue['id']}").status_code == 404
    assert api.activity()[0]["event_type"] == "issue.deleted"
    assert client.delete(f"/api/issues/{issue['id']}").status_code == 404
