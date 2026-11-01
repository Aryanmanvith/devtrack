# AI usage in DevTrack

This document records how artificial intelligence was used to build DevTrack, how its output was
checked, and the rules for using AI tools on this project. It is the disclosure to include with
any submission of this work. Check your university's policy on AI assistance as well.

## Summary

| | |
| --- | --- |
| Tool | Claude, an AI model made by Anthropic, working as a coding agent (Claude Code) in a cloud development environment |
| Role of the student | Wrote the specification: features, technology stack, design direction, quality requirements and the QA instructions the work had to meet |
| Role of the AI | Wrote the code, tests and documentation in this repository; ran the installers, test suites, linters and a browser; fixed the problems those runs exposed |
| Other assistants | None are recorded for this repository. No part of it is attributed to GitHub Copilot. If you use other tools from now on, add them here. |
| AI inside the app | None. DevTrack has no chatbot or AI feature and sends no data to any external service. |

Commits written by the AI carry the author `Claude <noreply@anthropic.com>` and a
`Co-Authored-By` trailer, so the Git history itself shows which changes it made.

## What the AI did

1. **Planning.** Turned the specification into a data model (projects, tasks, labels, issues,
   activity, preferences), a REST API design, and a page and component plan.
2. **Backend.** FastAPI application, SQLAlchemy models with database-level constraints, an
   Alembic migration, services for the status rules and metrics, the activity log, demo data,
   and a Pytest suite that runs every test on its own copy of the database with a fixed clock.
3. **Frontend.** React application with routing, data fetching, forms with validation, charts,
   the Kanban board, the command palette, light and dark themes, and Vitest component tests.
4. **End-to-end tests.** Playwright journeys for projects, tasks, issues, search and filters,
   error handling and the dashboard, plus a sweep of every other control on every page,
   all against a temporary database.
5. **QA audit.** Inventoried every interactive element, ran the suites, checked layouts at
   phone, tablet and desktop widths, looked for console errors and failed requests, and fixed
   what it found (see below and [QA_REPORT.md](QA_REPORT.md)).
6. **Documentation.** README, contributing guide, this file, the exam demo script and the QA report.

## How the output was checked

Nothing was accepted because it looked right. Every claim in the documentation was checked by
running something:

- **Automated tests**: API tests (Pytest), component tests (Vitest) and browser tests
  (Playwright). The counts from the final run are in [QA_REPORT.md](QA_REPORT.md).
- **Static checks**: TypeScript in strict mode, ESLint, Prettier, Ruff, and actionlint for the
  CI workflow.
- **The running application**: the dashboard's numbers compared with the API's, screenshots
  reviewed at three screen widths in both themes, and colour contrast measured against WCAG AA.

What was **not** verified: the Windows PowerShell commands (the work was done on Linux), the
GitHub Actions workflow on GitHub itself, and use with a real screen reader or touch device.

## Mistakes the checks caught

These are real examples from building DevTrack. They are the reason every AI-written change
must be run and tested before it is trusted.

| What the AI first produced | How it was caught | Fix |
| --- | --- | --- |
| An Alembic migration that referenced a custom column type without importing it, and silently skipped the case-insensitive unique index on project names | Running the migration on an empty database, then a duplicate-name test | Migration rewritten by hand with a plain `DateTime` and an explicit `lower(name)` index |
| Label validation that rejected `Backend` because the pattern was checked before lowercasing | API test | Normalise first with a `BeforeValidator` |
| A test helper that treated error responses as successful ones, so the error-handling tests passed without testing anything | Reading the tests critically after they all passed on the first run | Explicit `reply(status, body)` helper; the error tests now fail if the UI ignores errors |
| Kanban cards dropped on the fourth column landing in the fifth | Playwright drag-and-drop test | The board's auto-scroll zone was narrowed from 20% to 8% of its width |
| A filter coming back after being removed, when the removal happened while a search was still waiting to apply | Playwright control sweep, then a Vitest regression test that failed before the fix | URL updates now start from the router's current location instead of the last render's |
| Moving a card left or right with the keyboard doing nothing from most positions | Playwright control sweep and a step-by-step browser trace | Column-aware keyboard movement and collision detection for the board |
| Pressing Enter in the command palette sometimes opening a result from the previous search | Playwright control sweep, then a browser trace of the highlight | Old results are no longer shown while new ones load, and the highlight always sits on a current result |
| The page jumping back to an old scroll position about a second after a reload | An intermittent test failure, traced by logging every `scrollTo` call with a stack trace | Scroll positions are no longer carried across reloads |

## Rules for using AI on this project

1. **Understand before you commit.** If you cannot explain a line in a code review or a viva,
   do not commit it. Ask the tool to explain, read the documentation, or rewrite it yourself.
2. **Run it.** Generated code is a draft until the tests pass, including a test that fails
   without the change.
3. **Keep secrets and personal data out of prompts.** Never paste passwords, tokens, `.env`
   contents or other people's information into an AI tool.
4. **Check dependencies and licences.** Make sure any package the tool suggests exists, is
   maintained, and has a licence compatible with MIT.
5. **Disclose it.** Keep this file up to date and follow your institution's rules.
6. **Decisions stay with people.** The tool can propose a design; the team decides and is
   accountable for it.

## Student reflection

*To be written by the student. Do not let an AI write this section.*

- Which parts of the code did you read line by line, and which can you explain without notes?
- What did you change, reject or ask to be redone, and why?
- What did you learn about Git, GitHub, testing or full-stack development from this project?
- Where would you have made a different decision from the AI, and why?
