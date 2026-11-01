# Contributing to DevTrack

Thanks for helping. This guide covers how work moves from an idea to `main`. Setup is described
in the [README](README.md#run-it-on-windows-powershell).

## Ground rules

- Every visible control must do something real. No placeholder buttons, fake numbers or success
  messages shown before the server has saved the change.
- Every change comes with a test that would fail without it.
- Never commit secrets, `.env` files, databases (`*.db`), `node_modules/`, `.venv/` or build
  output. `.gitignore` covers these; check `git status` before committing anyway.
- Never force-push to `main`.

## Workflow

### 1. Start from an issue

Open an issue (or pick an existing one) using the **Bug report** or **Feature request** template,
so the problem and the acceptance criteria are written down before any code.

### 2. Create a branch

```powershell
git switch main
git pull
git switch -c feature/task-comments
```

| Prefix | Use for |
| --- | --- |
| `feature/` | new behaviour |
| `fix/` | bug fixes |
| `test/` | tests only |
| `docs/` | documentation only |
| `chore/` | tooling, dependencies, CI |

### 3. Commit in small steps

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(tasks): add comments to the task drawer
fix(board): keep the card in place when the move fails
test(api): cover deleting a project with open issues
docs: explain how to reset the database
```

The first line says what the change does, in the imperative and under about 70 characters. Add a
blank line and a short body when the reason is not obvious.

```powershell
git status
git add backend/app/services/tasks.py backend/tests/test_tasks.py
git commit -m "fix(api): reject deadlines before the project start date"
```

### 4. Run the checks

```powershell
# backend
cd backend
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m ruff format --check .
.\.venv\Scripts\python -m pytest

# frontend
cd ..\frontend
npm run check          # types, lint, formatting, component tests and build
npm run test:e2e       # when the change affects a user flow
```

`npm run format` and `.\.venv\Scripts\python -m ruff format .` fix formatting automatically.

### 5. Open a pull request

```powershell
git push -u origin feature/task-comments
```

Open the pull request on GitHub. The template asks what changed, how you tested it, and for
screenshots of anything visible. Link the issue with `Closes #12` so it closes on merge.
GitHub Actions runs the backend, frontend and end-to-end checks; a pull request is merged only
when they pass and someone else has reviewed it.

### 6. After merging

```powershell
git switch main
git pull
git branch -d feature/task-comments
```

## Database changes

The schema is defined in `backend/app/models.py` and versioned with Alembic.

1. Change the models.
2. Generate a migration from the `backend` folder:
   `.\.venv\Scripts\python -m alembic revision --autogenerate -m "add task comments"`
3. **Read the generated file.** Autogenerate misses some things (expression indexes such as
   `lower(name)`) and references custom column types it cannot import; fix those by hand.
4. Apply it with `.\.venv\Scripts\python -m app.manage init-db` and add tests.

## Code style

- **Python**: Ruff (lint and format), type hints on public functions, business rules in
  `app/services`, HTTP concerns in `app/routers`.
- **TypeScript**: strict mode, no `any`, ESLint and Prettier. Server data goes through TanStack
  Query hooks in `src/hooks`; filters live in the URL.
- **Accessibility**: every control has an accessible name, works with the keyboard and shows
  focus. Use the components in `src/components/ui` rather than new raw elements.
- **Copy**: sentence case, say what happens ("Save changes", not "Submit"), and make errors say
  what went wrong and how to fix it.

## AI tools

You may use AI assistants, but you are responsible for every line you commit: read it, run it,
test it, and be able to explain it. See [docs/AI_USAGE.md](docs/AI_USAGE.md).
