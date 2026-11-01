# DevTrack exam demo guide

A script for presenting DevTrack: a two-minute introduction, a five-minute live demo, the Git and
GitHub concepts you will be asked about, and answers to likely viva questions. Rehearse it at
least once with the timer running.

## Before the exam

- [ ] `git switch main` and `git status` shows a clean working tree.
- [ ] Refresh the demo workspace so its dates are relative to today. From `backend`:
      `.\.venv\Scripts\python -m app.manage seed-demo --reset`
- [ ] Terminal 1: `.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000`
- [ ] Terminal 2: `npm run dev`, then open <http://localhost:5173>
- [ ] Browser zoom at 100%, other tabs closed, notifications off, dark theme.
- [ ] A third terminal open in the repository root for Git commands.
- [ ] The GitHub repository open in a second tab (if it has been published), on the
      **Actions**, **Pull requests** and **Issues** pages.

## Two-minute introduction

> DevTrack is a project and issue tracker for student software teams. Students juggle several
> projects with deadlines, tasks and bugs spread across chat messages and documents. DevTrack
> puts them in one place: projects contain tasks and issues, tasks move across a Kanban board,
> and a dashboard shows what is overdue and how much was finished this week.
>
> It is a full-stack application. The frontend is React with TypeScript, built with Vite. The
> backend is a REST API written in Python with FastAPI. Data is stored in SQLite through
> SQLAlchemy, and the schema is versioned with Alembic migrations.
>
> Two principles guided the build. First, every number on screen is calculated from database
> records, and every number is clickable: it opens the records it counts. Second, the interface
> never claims success before the server has saved a change; if saving fails, the screen goes
> back to what is really stored and explains what happened.
>
> The project was developed with Git feature branches merged into main, and it is tested at three
> levels: API tests with Pytest, component tests with Vitest, and end-to-end browser tests with
> Playwright. GitHub Actions runs all of them on every push and pull request. I used an AI coding
> assistant during development; I will explain how I used it and how its work was checked.

## Five-minute live demo

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Show the dashboard. Point at the four metric cards. | "These come from the database, calculated in my time zone. Overdue means open tasks with a deadline before today." |
| 0:30 | Click **Overdue tasks**. Point at the filter chip, then remove it. | "Every number opens its records. The filter is in the URL, so this view can be bookmarked." |
| 0:50 | Projects → **Create project**: name "Exam demo", deadline next Friday. Then try the same name again. | "Validation runs in the browser and again on the server. Duplicate names are rejected by the database itself." |
| 1:30 | On the new project, **Create task**: "Prepare slides", priority High, deadline tomorrow, label `exam`. | "The task belongs to the project; deadlines and labels are validated before anything is sent." |
| 2:00 | **Open board**. Drag the card from To Do to In Progress. Press F5. | "The move is saved with a PATCH request. After a reload it is still there, because the screen shows what the database stores." |
| 2:40 | Optional: focus the card's handle, press Space, Right arrow, Space. | "The board also works without a mouse, and announces each step to screen readers." |
| 3:00 | Issues → **Create issue**: a bug in "Exam demo". Open it, click **Resolve**, show **History**. | "Issues have their own lifecycle. Every change is written to the activity log in the same transaction as the change itself." |
| 3:40 | Back to the dashboard. Show that **Open tasks** went up by one. Click a week in the trend chart, then **View completed tasks**. | "The dashboard refreshed itself after each change, and the charts lead to the underlying tasks." |
| 4:20 | Settings: switch to the light theme, reload, switch back. | "Preferences are stored and survive a reload." |
| 4:40 | Terminal: `git log --oneline --graph -15`. | "Each feature was built on its own branch and merged into main; the history shows it." |

If something goes wrong during the demo, say what you expected, then show the error message; the
app is designed to explain failures, and recovering calmly is part of the demonstration.

## Git and GitHub

**Git** is a version control system that runs on your computer. It records snapshots of the
project (commits), lets you work on parallel lines of development (branches), and combines them
(merges). It works without a network.

**GitHub** is a website that hosts Git repositories and adds collaboration around them: pull
requests for review, issues for planning and bug tracking, Actions for automated checks, and
access control. Git is the tool; GitHub is one service built around it (GitLab and Bitbucket are
others).

| Concept | What it is | In this project |
| --- | --- | --- |
| Commit | A saved snapshot with a message and an author. | Small, focused commits with Conventional Commit messages such as `feat(tasks): ...` and `fix(board): ...`. |
| Branch | A movable pointer to a line of commits, so work can happen without disturbing `main`. | One branch per feature: `feature/backend-api`, `feature/dashboard`, `feature/task-management`, and so on. |
| Merge | Combining a branch's commits into another branch. | Each branch was merged into `main` with `git merge --no-ff`, which always creates a merge commit, so the feature stays visible in the graph. |
| Pull request | A GitHub request to merge a branch, with discussion, review and CI results. | The template in `.github/PULL_REQUEST_TEMPLATE.md` asks what changed and how it was tested. |
| Issue | A GitHub record of a bug, task or idea that can be discussed, assigned and linked to commits and pull requests. | Bug report and feature request templates in `.github/ISSUE_TEMPLATE/`; writing `Closes #12` in a pull request closes the issue on merge. |
| CI (GitHub Actions) | Automated checks on every push or pull request. | `.github/workflows/ci.yml`: Ruff and Pytest, then type check, lint, Vitest and build, then Playwright. |

Commands worth showing:

```powershell
git log --oneline --graph --all     # the branch and merge history
git branch -a                       # local and remote branches
git show --stat HEAD                # what the last commit changed
git switch -c feature/demo          # create a branch
git diff main...feature/demo        # what a branch adds compared with main
```

## How the parts work together

1. **Frontend (browser).** React renders pages from components. TanStack Query fetches data from
   the API, caches it, and refetches whatever depends on a change after each save. React Hook
   Form with Zod validates forms before anything is sent. Filters live in the URL.
2. **Backend (FastAPI).** Each endpoint validates its input with Pydantic and calls a service
   function. Services hold the rules: allowed status changes, `completed_at` set when a task is
   done, progress and overdue calculations, and writing the activity log.
3. **Database (SQLite).** SQLAlchemy maps Python classes to tables. Constraints in the database
   (foreign keys, unique names, valid statuses, date order) protect the data even if a bug got
   past the API. Alembic migrations create and upgrade the schema; the API applies them at startup.
4. **Between them**: JSON over HTTP. In development, the Vite server forwards `/api` requests to
   port 8000, so the browser talks to a single origin.

## Responsible AI use (what to say)

- I used Claude, an AI coding assistant, to generate much of the code, tests and documentation
  from my specification. This is disclosed in `docs/AI_USAGE.md`, and the AI's commits are
  labelled in the Git history.
- I did not accept output because it looked right. It was checked by tests at three levels,
  static analysis and running the app in a browser; those checks caught real mistakes, such as a
  migration that silently skipped an index, and a filter that came back after being removed.
- I am responsible for the result, so I read the code to be able to explain it. (Describe what
  you reviewed yourself, from the reflection section of `AI_USAGE.md`.)
- The app itself uses no AI and sends no data anywhere.

## Viva questions and answers

**Why SQLite rather than PostgreSQL?**
It is one file, needs no server, and is enough for a single-user local tool. The code uses
SQLAlchemy and Alembic, so moving to PostgreSQL mostly means changing the connection URL and
testing; it would be needed for many simultaneous users.

**How is "overdue" calculated?**
An open task (any status except Done) whose deadline is before today, where "today" is calculated
in the user's time zone, sent by the browser in the `X-Timezone` header. Archived projects are excluded.

**How do you know the dashboard numbers are correct?**
The API tests create known records with a frozen clock and assert the exact metrics. The
Playwright journey F reads each number on the dashboard and compares it with the API response.

**What is a migration, and why not just create the tables?**
A migration is a versioned script that changes the schema from one version to the next. It lets
every copy of the database (mine, a teammate's, a server's) be upgraded in a controlled way
without losing data.

**What is CORS, and why is it configured?**
Browsers block a page from reading responses from another origin unless that server allows it.
In development the Vite proxy makes requests same-origin, but the API also allows
`localhost:5173` explicitly so the frontend can call it directly if configured to.

**How does the Kanban board remember card order?**
Each task has a numeric `position`. A dropped card gets a position between its new neighbours,
so only that one task is updated.

**What happens if saving a drag fails?**
The card moves immediately (optimistic update). If the server returns an error, the cached data
is rolled back, the card returns to its column, and a message explains what failed. A Vitest test
and a Playwright test force a server error to check this.

**How do you stop a form from being submitted twice?**
The submit button is disabled and shows a spinner while the request is pending, and the dialog
cannot be closed until the server has answered.

**What is the difference between unit, component and end-to-end tests here?**
Pytest tests the API through HTTP against a real database copy. Vitest renders real pages in a
simulated browser with a mocked API. Playwright drives a real browser against the real API and a
temporary database.

**Why do the tests use their own databases?**
So tests cannot affect each other or the developer's data. Every API test gets a fresh copy of a
migrated database, so they can run in any order. The browser tests share one temporary database
for the run, and each test creates records with unique names, so it never depends on what other
tests left behind.

**What does `git merge --no-ff` do?**
It always creates a merge commit, even when Git could simply move the branch pointer forward.
The history then shows which commits belonged to which feature.

**Merge or rebase?**
Merging keeps history as it happened and adds merge commits; rebasing rewrites a branch's commits
on top of another branch for a linear history. Never rebase commits that others have already pulled.

**How would you add authentication?**
Add a users table, password hashing (for example Argon2), session or token-based login, and an
owner or member relation on projects; every query would then filter by the current user, with
tests for access to other users' data.

**What is the activity log for, and why is it written in the same transaction?**
It is an audit trail of what changed. Writing it in the same transaction means a change and its
log entry are saved together or not at all, so the log cannot describe a change that never happened.

**What would you improve with more time?**
Accounts and permissions, comments on tasks, PostgreSQL with a deployment, and testing in more
browsers and with a screen reader.

**What did the AI get wrong, and how did you notice?**
See the table in `docs/AI_USAGE.md`: for example, Kanban drops landing one column too far, found
by an end-to-end drag test, and fixed by narrowing the board's auto-scroll zone.
