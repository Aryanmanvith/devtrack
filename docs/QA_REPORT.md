# QA report

Final end-to-end audit of DevTrack, run on 1 November 2026. The results below come from
commands that were actually executed; nothing is estimated. Where something could not be
verified, it says so.

## Summary

| Measure | Result |
| --- | --- |
| Interactive elements inventoried | 238 |
| Verified working by an automated test in the final run | 238 |
| Failing | 0 |
| Not tested | 0 (limits of these results are listed at the end) |
| Backend API tests (Pytest) | 68 passed, 0 failed |
| Frontend component tests (Vitest) | 37 passed, 0 failed |
| End-to-end browser tests (Playwright, Chromium) | 28 passed, 0 failed |
| Static checks | Ruff, Ruff format, TypeScript (strict), ESLint, Prettier and actionlint report no problems |
| Production build | `vite build` succeeds |
| GitHub Actions CI | First run on GitHub passed all three jobs: backend, frontend and end-to-end ([run 41321125150](https://github.com/Aryanmanvith/devtrack/actions/runs/41321125150)) |
| Defects in DevTrack found and fixed | 12 (listed below) |

Every element in the inventory was used by an automated test that passed in the final run.
That does not make the application defect-free: see
[What these results do not cover](#what-these-results-do-not-cover).

## Environment

| Item | Version |
| --- | --- |
| Operating system | Ubuntu 24.04.5 LTS (Linux), cloud container |
| Python | 3.13.18 (FastAPI 0.162.0, SQLAlchemy 2.1.6, Pydantic 2.14.2, Alembic 1.20.1, Uvicorn 0.54.0) |
| Node.js / npm | 22.23.4 / 10.9.9 (React 19.3.1, Vite 8.3.5, TypeScript 5.9.3, Vitest 5.0.5) |
| Browser | Chrome for Testing 153.0.8010.12, driven by Playwright 1.64.1 |

## How the audit was done

1. **Inventory.** Every page was opened in Chromium (with the demo workspace and with an
   empty one), and every visible control was listed by role and accessible name. Menus,
   dialogs, drawers, empty states and error states were then opened to list their controls
   too. A control repeated on every row (for example the status menu on each task) counts once
   per place it appears. The result is the matrix below.
2. **Evidence.** Each element was matched to an automated test that uses it the way a person
   would (mouse or keyboard) and checks the visible result. For anything that changes data,
   the test also reads the record back from the API, and for persistence it reloads the page.
3. **Gaps and failures.** Elements without a test got one. Tests that failed were investigated
   to the root cause; product defects were fixed in the application, and test mistakes
   in the test. Every fix is covered by a test that passes now; for defects 1–4, 7 and 8
   below, that test was also seen failing before the fix.
4. **Final run.** All suites were run again on the final commit, and once more from a fresh
   clone with a clean install (new virtual environment, `npm ci`) to prove that nothing depends
   on files outside Git.

The end-to-end tests never touch the developer database: Playwright starts its own API on
port 8001 with a new temporary SQLite file and demo data turned off, and its own Vite server on
port 5174.

## Commands and results

From a fresh clone of the repository:

```text
backend$ python3.13 -m venv .venv
backend$ .venv/bin/python -m pip install -r requirements-dev.txt
backend$ .venv/bin/python -m ruff check .            All checks passed!
backend$ .venv/bin/python -m ruff format --check .   41 files already formatted
backend$ .venv/bin/python -m pytest                  68 passed in 15.80s

frontend$ npm ci                                      exit 0
frontend$ npm run check                               typecheck, lint, format:check: exit 0
                                                      Test Files 5 passed (5), Tests 37 passed (37)
                                                      vite build: built in 2.93s
frontend$ npx playwright test                         27 passed (11.1m)
$ git status --short                                  (empty: tests leave no files behind)
```

That clean-clone run was on commit `88110e3`. After it, the extended sweep found three more
defects (numbers 6 to 8 below). The final commit, `fbad263`, includes their fixes and the extra
checks. On it:

```text
backend$ .venv/bin/python -m ruff check .            All checks passed!
backend$ .venv/bin/python -m ruff format --check .   41 files already formatted
backend$ .venv/bin/python -m pytest                  68 passed in 19.89s
frontend$ npm run typecheck && npm run lint           exit 0
frontend$ npm run format:check                        All matched files use Prettier code style!
frontend$ npm test                                    Test Files 5 passed (5), Tests 37 passed (37)
frontend$ npm run build                               built in 3.62s
frontend$ npx playwright test                         28 passed (11.5m)
frontend$ npx playwright test g-controls -g "dashboard: summary" --repeat-each=2
                                                      2 passed (first test on a fresh server, where it used to fail)
```

`.github/workflows/ci.yml` was checked with actionlint 1.7.12 (no errors). Its first run on
GitHub, started by pushing `main` (`8f48f9a`) to the repository, passed all three jobs on
GitHub's Ubuntu runners
([run 41321125150](https://github.com/Aryanmanvith/devtrack/actions/runs/41321125150)):

```text
Backend · lint and tests                       ruff clean; 68 passed in 6.24s
Frontend · types, lint, unit tests and build   Test Files 5 passed (5), Tests 37 passed (37); build succeeded
End-to-end · Playwright                        28 passed (6.7m), no retries
```

## Defects found and fixed

All were found by the checks described above, during the build and this audit.

| # | Defect | How it was found | Fix |
| --- | --- | --- | --- |
| 1 | Dropping a card on the fourth Kanban column at 1440 px landed it in the fifth: the default auto-scroll zone (20% of the board's width) covered the target column. | Journey B (mouse drag) | Zone narrowed to 8% (`3f5b6dd`) |
| 2 | A filter removed while a search was still waiting to apply came back: URL updates were computed from the last rendered URL, not the current one. | Control sweep; Vitest regression test | URL updates start from the router's current location (`7a5db98`) |
| 3 | After "Clear all", a focused search box could keep showing text that was no longer applied. | Control sweep; Vitest regression test | The box compares with the last search it sent instead of checking focus (`7a5db98`) |
| 4 | Left and Right arrow keys did not move a card between columns from most positions. | Control sweep; browser trace of each key press | Column-aware keyboard movement (`98430d5`) |
| 5 | A card low in a tall column could be matched to a card in the next column. | Same trace | Collision detection chooses the column first (`98430d5`) |
| 6 | The History section of a record without history showed a heading above nothing. | Screenshot review of the issue drawer | "No changes recorded yet." (`e9c057e`) |
| 7 | In the command palette, typing a new search and pressing Enter could open a record from the previous search: old results stayed on screen while new ones loaded, and the highlight stayed on them. | Control sweep (Enter opened the wrong drawer); step-by-step browser trace | No stale results; the highlight always sits on a current result (`67fde2a`) |
| 8 | About a second after a reload, the page could jump back to the scroll position saved before the reload, even while a menu was open. | Intermittent control-sweep failure; traced to React Router's scroll restoration with an instrumented copy of the test that logged every `scrollTo` call | Positions are no longer carried across reloads; Back and Forward still restore them (`092dd75`) |
| 9 | The board page scrolled sideways: visually hidden text escaped the board's scroll container. | Layout check (`scrollWidth` larger than the window) | Positioned the containers (fixed before the feature commits) |
| 10 | Browser console warning: React Router had no fallback while loading a page's code. | Console check on every page | Loading screen added as the hydrate fallback (fixed before the feature commits) |
| 11 | Failed requests (`net::ERR_ABORTED`) on every page load in development. | Network check | Requests are no longer cancelled when React re-runs effects (fixed before the feature commits) |
| 12 | A skeleton `div` inside a paragraph produced an invalid-HTML console error on the dashboard. | Console check | Restructured the header (fixed before the feature commits) |

Mistakes in the tests themselves were corrected too, and are not counted above. The most
important: the component tests' API mock treated error responses as successes, so the
error-handling tests passed without testing anything. The mock now returns real status codes,
and those tests fail if the interface ignores an error. Others were locators that matched a
notification as well as a list row, and assertions that ran before the page had updated.

## Functionality matrix

Evidence key:

| Code | Test |
| --- | --- |
| A–F | User journeys `e2e/a-projects`, `b-tasks`, `c-issues`, `d-search-filters`, `e-errors` (E1–E4), `f-dashboard` |
| G:area | Control sweep `e2e/g-controls.spec.ts`, the test for that area (shell, dashboard, projects, detail, tasks, board, issues, activity, analytics, settings, palette, empty, no-match, errors, responsive) |
| N:area | `e2e/navigation.spec.ts` (links, settings, palette, mobile) |
| V:file | Vitest component tests in `frontend/src/pages/*.test.tsx` (dashboard, projects, tasks, issues, board) |

Where a control offers several options (each sort order, filter value or date range), the
browser test uses at least one option end to end, and the API tests check the query behind
every option (`test_filters_search_and_sorting`, `test_due_date_filters`,
`test_completed_date_range_filter`, `test_list_search_filter_and_sort`, `test_sort_by_progress`,
`test_analytics_overview_respects_filters`).

### App shell and navigation

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Skip to content link | Moves focus to the main content | Pass | G:shell |
| 2 | Logo | Opens the overview | Pass | G:shell |
| 3 | Sidebar: Overview | Opens the dashboard | Pass | N:links |
| 4 | Sidebar: My Tasks (open count) | Opens My Tasks | Pass | N:links |
| 5 | Sidebar: Projects | Opens Projects | Pass | N:links |
| 6 | Sidebar: Kanban Board | Opens the board | Pass | N:links |
| 7 | Sidebar: Issues (open count) | Opens Issues | Pass | N:links |
| 8 | Sidebar: Activity | Opens Activity | Pass | N:links |
| 9 | Sidebar: Analytics | Opens Analytics | Pass | N:links |
| 10 | Sidebar: Settings | Opens Settings | Pass | N:links |
| 11 | Profile link | Shows the display name and opens Settings | Pass | G:shell, N:settings |
| 12 | Theme menu (Dark, Light, System) | Switches theme immediately and remembers it | Pass | G:shell, G:settings |
| 13 | Collapse / expand sidebar | Collapses to icons; remembered after reload | Pass | G:shell |
| 14 | Collapsed sidebar tooltips | Show each icon's label on hover or focus | Pass | G:shell |
| 15 | Search button | Opens the command palette | Pass | N:palette |
| 16 | Ctrl K shortcut | Opens the command palette from any page | Pass | N:palette, G:palette |
| 17 | Deadline alerts bell | Opens the overdue and due-soon list | Pass | N:palette, G:palette |
| 18 | Deadline alert item | Opens the task drawer | Pass | G:palette |
| 19 | View all overdue tasks | Opens My Tasks filtered to overdue | Pass | N:palette |
| 20 | Create menu: Task | Opens the task form | Pass | G:shell |
| 21 | Create menu: Project | Opens the project form | Pass | G:shell |
| 22 | Create menu: Issue | Opens the issue form | Pass | G:shell |
| 23 | Mobile navigation button and sheet | Opens the menu, navigates, closes | Pass | N:mobile |
| 24 | Dialog close button (x) | Closes the dialog without saving | Pass | G:shell |

### Command palette

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 25 | Search field | Searches projects, tasks and issues on the server | Pass | N:palette, G:palette |
| 26 | Project result | Opens the project | Pass | N:palette, G:palette |
| 27 | Task result | Opens the task drawer | Pass | G:palette |
| 28 | Issue result | Opens the issue drawer | Pass | G:palette |
| 29 | Keyboard selection (Enter) | Opens the highlighted result | Pass | G:palette |
| 30 | No-results message | Says nothing matched | Pass | G:palette |
| 31 | Create task / project / issue actions | Open the matching form | Pass | G:palette |
| 32 | Go to entries (8 pages) | Open each page | Pass | G:palette |

### Dashboard

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 33 | Summary link: overdue | Opens overdue tasks | Pass | G:dashboard |
| 34 | Summary link: due this week | Opens open tasks due this week | Pass | G:dashboard |
| 35 | Summary link: open tasks | Opens open tasks | Pass | G:dashboard |
| 36 | Summary link: active projects | Opens active projects | Pass | G:dashboard |
| 37 | Create project | Opens the project form | Pass | A |
| 38 | Create task | Opens the task form | Pass | G:dashboard |
| 39 | Demo notice: Manage demo data | Opens Settings at Demo data | Pass | G:settings |
| 40 | Demo notice: dismiss | Hides the notice; remembered after reload | Pass | G:settings |
| 41 | KPI: Active projects | Value from the API; opens active projects with the filter shown | Pass | G:dashboard, V:dashboard |
| 42 | KPI: Open tasks | Value from the API; changes after creating a task; opens open tasks | Pass | B, F, G:dashboard |
| 43 | KPI: Completed this week | Value from the API; opens tasks completed this week | Pass | F |
| 44 | KPI: Overdue tasks | Value from the API; opens overdue tasks with the filter shown | Pass | F |
| 45 | Trend: range (4, 8, 12 weeks) | Reloads the chart for the range | Pass | F, G:dashboard |
| 46 | Trend: series toggles | Hide and show Completed and Still open | Pass | G:dashboard |
| 47 | Trend: previous / next week | Step through weeks; details update | Pass | G:dashboard |
| 48 | Trend: click a bar | Selects that week | Pass | G:dashboard |
| 49 | Trend: tooltip | Shows the week's figures on hover | Pass | G:dashboard |
| 50 | Trend: View completed tasks | Opens the tasks completed in the selected week | Pass | F |
| 51 | Distribution: Status / Priority | Switches the breakdown | Pass | G:dashboard |
| 52 | Distribution: legend entries | Open the tasks in that status or priority | Pass | F, G:dashboard |
| 53 | Distribution: chart segment | Opens the tasks in that segment | Pass | G:dashboard |
| 54 | Distribution: segment tooltip | Shows count and share on hover | Pass | G:dashboard |
| 55 | My tasks: status menu | Changes status; saved to the API | Pass | G:dashboard |
| 56 | My tasks: task title | Opens the task drawer | Pass | G:dashboard |
| 57 | My tasks: project link | Opens the project | Pass | G:dashboard |
| 58 | My tasks: View all | Opens open tasks | Pass | G:dashboard |
| 59 | Deadlines: task | Opens the task drawer | Pass | F |
| 60 | Deadlines: project link | Opens the project | Pass | G:dashboard |
| 61 | Deadlines: View overdue (N) | Opens overdue tasks | Pass | G:dashboard |
| 62 | Projects panel: project | Opens the project | Pass | G:dashboard |
| 63 | Projects panel: actions menu | Opens the board for the project | Pass | G:dashboard |
| 64 | Projects panel: View all | Opens Projects | Pass | G:dashboard |
| 65 | Recent activity: entry | Opens the record it describes | Pass | F |
| 66 | Recent activity: View all | Opens Activity | Pass | G:dashboard |
| 67 | Empty-panel actions (Create task x2, Create project) | Open the matching form | Pass | G:empty |
| 68 | Section error: Try again | Retries the request | Pass | V:dashboard |

### Projects page

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 69 | Create project | Opens the form; new project appears | Pass | E2, G:empty |
| 70 | Search | Filters by name on the server | Pass | G:projects |
| 71 | Status filter | Filters by status; Archived shows archived projects | Pass | G:projects |
| 72 | Sort | Orders by name, deadline, progress, dates | Pass | G:projects |
| 73 | Grid / list view | Switches layout; kept in the URL | Pass | G:projects |
| 74 | Filter chip remove | Removes one filter | Pass | G:projects |
| 75 | Clear all | Removes all filters, keeps the sort | Pass | G:projects |
| 76 | Project card / table row | Opens the project page | Pass | A, G:projects |
| 77 | Overdue indicator | Shown when the deadline has passed | Pass | G:projects |
| 78 | Card menu: Open project | Opens the project page | Pass | G:projects |
| 79 | Card menu: Open Kanban board | Opens the board filtered to the project | Pass | G:projects |
| 80 | Card menu: Edit project | Opens the form pre-filled; saves | Pass | G:projects |
| 81 | Card menu: Archive | Archives; hidden from the default list | Pass | G:projects |
| 82 | Card menu: Restore | Restores to Active | Pass | G:projects |
| 83 | Card menu: Delete | Asks first; Cancel keeps it, Delete removes it | Pass | G:projects |
| 84 | No-match state: Clear filters | Resets the filters | Pass | G:projects |

### Project form

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 85 | Name | Required; unique ignoring case | Pass | A, E2, V:projects |
| 86 | Description | Optional text | Pass | A |
| 87 | Status | Saved | Pass | G:projects |
| 88 | Owner | Saved | Pass | G:projects |
| 89 | Start date | Saved; checked against the deadline | Pass | G:projects, V:projects |
| 90 | Deadline | Saved; not before the start date | Pass | A, V:projects |
| 91 | Colour | Saved | Pass | G:projects |
| 92 | Create / Save changes | Saves; success shown only after the server confirms | Pass | A, G:projects, V:projects |
| 93 | Cancel | Closes without saving | Pass | G:shell |
| 94 | Validation messages | Shown on the field, typed values kept | Pass | E2, V:projects |

### Project page

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 95 | Breadcrumb: Projects | Opens Projects | Pass | G:detail |
| 96 | Open board | Opens the board filtered to the project | Pass | G:detail |
| 97 | Edit | Opens the form pre-filled; saves | Pass | A |
| 98 | Create task (header) | Opens the form with the project selected | Pass | G:detail |
| 99 | More: Open Kanban board | Opens the board filtered to the project | Pass | G:detail |
| 100 | More: Archive / Restore | Archives with a notice; restores | Pass | G:detail |
| 101 | More: Delete | Asks first; deletes and returns to Projects | Pass | A |
| 102 | Tasks-by-status links | Open the project's tasks in that status | Pass | G:detail |
| 103 | Tabs: Tasks, Issues, Activity | Switch the panel | Pass | G:detail |
| 104 | Tab row: Create task / Create issue | Open the form with the project selected | Pass | G:detail |
| 105 | Task row: status menu | Changes status; saved | Pass | G:detail |
| 106 | Task row: completion checkbox | Completes and reopens; saved | Pass | G:detail |
| 107 | Task row: title | Opens the task drawer | Pass | G:detail |
| 108 | Task row: actions menu (Edit task) | Opens the form; saves | Pass | G:detail |
| 109 | Issue row | Opens the issue drawer | Pass | G:detail |
| 110 | Activity entry | Opens the record it describes | Pass | G:detail |
| 111 | Empty tabs: Create task / Create issue | Open the matching form | Pass | G:empty |
| 112 | Unknown project: Back to projects | Clear message and a way back | Pass | E3 |

### My Tasks

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 113 | Create task | Opens the form; new task appears | Pass | B |
| 114 | Search | Searches titles and descriptions on the server; kept in the URL | Pass | D, V:tasks |
| 115 | Clear search (x) | Empties the search | Pass | G:tasks |
| 116 | Status filter | Includes Open (not done) | Pass | D, V:tasks |
| 117 | Priority filter | Filters by priority | Pass | D |
| 118 | Project filter | Filters by project | Pass | G:tasks |
| 119 | Deadline filter | Overdue, today, this week, upcoming, none | Pass | G:tasks, F |
| 120 | Label filter | Filters by label | Pass | G:tasks |
| 121 | Filter chip remove | Removes one filter | Pass | D, G:tasks |
| 122 | Clear all | Removes all filters | Pass | D, V:tasks |
| 123 | Sort | Deadline, priority, created, updated, title | Pass | D, G:tasks, V:tasks |
| 124 | Sort direction (with tooltip) | Reverses the order | Pass | D, G:tasks, V:tasks |
| 125 | Row: completion checkbox | Completes and reopens; saved | Pass | G:tasks, V:tasks |
| 126 | Row: title | Opens the task drawer | Pass | G:tasks |
| 127 | Row: status menu | Changes status; undone if the server fails | Pass | B, E4, V:tasks |
| 128 | Row: project link | Opens the project | Pass | G:tasks |
| 129 | Row menu: Open details | Opens the drawer | Pass | G:tasks |
| 130 | Row menu: Edit task | Opens the form pre-filled | Pass | G:tasks |
| 131 | Row menu: Delete task | Asks first; Cancel keeps it | Pass | G:tasks |
| 132 | Empty state: Create task | Opens the form | Pass | G:empty |
| 133 | No-match state: Clear filters | Resets the filters | Pass | G:no-match |

### Task form

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 134 | Title | Required | Pass | B, E1 |
| 135 | Description | Saved | Pass | G:detail |
| 136 | Project | Required; preselected when opened from a project | Pass | B, E1, G:detail |
| 137 | Deadline | Saved; shown as Due tomorrow etc. | Pass | B |
| 138 | Status | Saved; preselected from a board column | Pass | G:tasks, G:board |
| 139 | Priority | Saved | Pass | B |
| 140 | Labels | Letters, numbers and hyphens; checked before sending | Pass | B, E1 |
| 141 | Label suggestions (Used before) | Add the label in one click | Pass | G:tasks |
| 142 | Create / Save changes | Saves; success only after the server confirms | Pass | B, G:detail, G:tasks |
| 143 | No projects yet: Create project | Explains why and opens the project form | Pass | G:shell |

### Task drawer

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 144 | Status menu | Changes status; Done sets the completion date | Pass | B |
| 145 | Priority menu | Changes priority; saved | Pass | G:tasks |
| 146 | Edit | Opens the form; saves | Pass | G:tasks |
| 147 | Delete | Asks first; deletes | Pass | B |
| 148 | Project link | Opens the project | Pass | G:tasks |
| 149 | Close details | Closes and removes ?task= from the URL | Pass | G:tasks |
| 150 | Opened from a link (?task=) | Opens the drawer for that task | Pass | G:tasks |
| 151 | Missing task | Says the task no longer exists | Pass | E3 |
| 152 | Empty history | Says no changes are recorded yet | Pass | G:empty |

### Kanban board

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 153 | Project filter | Shows one project's cards; chip shown | Pass | G:board |
| 154 | Card filter | Filters cards by title or label | Pass | G:board |
| 155 | Clear all | Removes both filters | Pass | G:board |
| 156 | Create task (header) | Opens the form with the project selected | Pass | G:board |
| 157 | Column + buttons | Open the form with that status | Pass | G:board |
| 158 | Drag to another column (mouse) | Moves the card; saved; survives reload | Pass | B |
| 159 | Reorder within a column (mouse) | New order saved; survives reload | Pass | G:board |
| 160 | Keyboard move (Space, arrows, Space) | Moves the card; announced; saved | Pass | G:board |
| 161 | Escape during a move | Cancels; card stays | Pass | G:board |
| 162 | Card title | Opens the task drawer | Pass | B |
| 163 | Card status menu | Moves the card to that column | Pass | V:board |
| 164 | Card actions menu | Opens details | Pass | G:board |
| 165 | Open project | Opens the selected project | Pass | G:board |
| 166 | Failed move | Card returns to its column with a message | Pass | V:board |
| 167 | Empty board: Create task | Opens the form | Pass | G:empty |

### Issues page

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 168 | Create issue | Opens the form; new issue appears | Pass | C |
| 169 | Tabs: Open, Resolved and closed, All | Switch the list; counts shown | Pass | C, G:issues |
| 170 | Search | Searches titles and descriptions | Pass | G:issues |
| 171 | Type filter | Bug, feature, improvement, question | Pass | G:issues |
| 172 | Priority filter | Filters by priority | Pass | G:issues |
| 173 | Project filter | Filters by project | Pass | G:issues |
| 174 | Sort | Newest, updated, priority, title | Pass | G:issues |
| 175 | Clear all | Removes all filters | Pass | G:issues |
| 176 | Row: title | Opens the issue drawer | Pass | C |
| 177 | Row: project link | Opens the project | Pass | G:issues |
| 178 | Row: priority menu | Changes priority; saved | Pass | C, V:issues |
| 179 | Row menu: Open details | Opens the drawer | Pass | G:issues |
| 180 | Row menu: Edit issue | Opens the form; saves | Pass | G:issues |
| 181 | Row menu: Resolve | Resolves; date recorded | Pass | G:issues |
| 182 | Row menu: Close without fixing | Closes | Pass | G:issues |
| 183 | Row menu: Reopen | Reopens; resolution date cleared | Pass | G:issues |
| 184 | Row menu: Delete issue | Asks first; Cancel keeps it | Pass | G:issues |
| 185 | Empty state: Create issue | Opens the form | Pass | G:empty |
| 186 | No-match state: Clear filters | Resets the filters | Pass | G:no-match |

### Issue form

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 187 | Title | Required | Pass | C |
| 188 | Description | Saved | Pass | C, G:issues |
| 189 | Project | Required | Pass | C |
| 190 | Type | Saved | Pass | C |
| 191 | Priority | Saved | Pass | G:issues |
| 192 | Status | Saved | Pass | G:issues |
| 193 | Create / Save changes | Saves; success only after the server confirms | Pass | C, G:issues |

### Issue drawer

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 194 | Start progress | Marks in progress; saved | Pass | G:issues |
| 195 | Resolve | Resolves; saved | Pass | C, V:issues |
| 196 | Close | Closes; saved | Pass | G:issues |
| 197 | Reopen | Reopens; saved | Pass | C, G:issues |
| 198 | Priority menu | Changes priority; saved | Pass | G:issues |
| 199 | Edit | Opens the form | Pass | G:issues |
| 200 | Delete | Asks first; deletes | Pass | C |
| 201 | Project link | Opens the project | Pass | G:issues |
| 202 | Close details | Closes the drawer | Pass | G:issues |
| 203 | Opened from a link (?issue=) | Opens the drawer for that issue | Pass | G:issues |

### Activity page

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 204 | Type filter (All, Projects, Tasks, Issues, System) | Filters entries | Pass | G:activity |
| 205 | Search | Filters by description | Pass | G:activity |
| 206 | Project filter | Filters by project | Pass | G:activity |
| 207 | Clear all | Removes all filters | Pass | G:activity |
| 208 | Load more | Loads the next 25 entries, then disappears | Pass | G:activity |
| 209 | Entry: task | Opens the task drawer | Pass | G:activity, F |
| 210 | Entry: issue | Opens the issue drawer | Pass | G:activity |
| 211 | Entry: project | Opens the project | Pass | G:activity |
| 212 | Entry for a deleted record | Marked as deleted, not a link | Pass | C |
| 213 | No-match state: Clear filters | Resets the filters | Pass | G:no-match |

### Analytics page

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 214 | Project filter | Recalculates for one project | Pass | G:analytics |
| 215 | Range (4, 8, 12, 26 weeks) | Reloads the trend | Pass | G:analytics |
| 216 | Series toggles (Completed, Created, Still open) | Hide and show series | Pass | G:analytics |
| 217 | Metric links (6) | Open the records each figure counts | Pass | G:analytics |
| 218 | Trend bar | Opens that week's completed tasks | Pass | G:analytics |
| 219 | Tasks-by-status links | Open tasks in that status | Pass | G:analytics |
| 220 | Priority links | Open open tasks with that priority | Pass | G:analytics |
| 221 | Project progress links | Open the project | Pass | G:analytics |
| 222 | Issues-by-type links | Open issues of that type | Pass | G:analytics |
| 223 | Completion calendar days | Open tasks completed that day | Pass | G:analytics |

### Settings

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 224 | Display name: Save name | Saved; shown in the greeting and sidebar | Pass | N:settings |
| 225 | Display name: validation, Cancel, Save disabled until changed | Blank names rejected; Cancel restores | Pass | G:settings |
| 226 | Theme: Dark / Light | Applied at once; kept after reload | Pass | N:settings |
| 227 | Theme: System | Follows the operating system setting | Pass | G:settings |
| 228 | Week starts on | Saved; weekly figures use it | Pass | G:settings |
| 229 | Load demo data | Adds the demo workspace | Pass | G:settings |
| 230 | Remove demo data | Asks first; removes only demo records | Pass | G:settings |
| 231 | Open API documentation | Links to the running API's /docs | Pass | G:settings |

### Errors and edge cases

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 232 | Unknown page: Go to overview | 404 message and a way back | Pass | E3 |
| 233 | API unreachable: Try again | Clear message; retry works | Pass | E4, V:dashboard |
| 234 | Page failed to load: Reload page | Reloads and recovers | Pass | G:errors |
| 235 | Page failed to load: Go to overview | Returns to the dashboard | Pass | G:errors |
| 236 | Failed save | Change undone, message shown, no success toast | Pass | E4, V:tasks, V:board |
| 237 | Invalid form | Nothing sent; messages on the fields | Pass | E1, V:projects |

### Layout

| # | Element | Expected behaviour | Status | Evidence |
| --- | --- | --- | --- | --- |
| 238 | Phone (390 px) and tablet (820 px) widths | Every page fits without horizontal scrolling; no console errors | Pass | G:responsive, N:mobile |

## Visual and responsive checks

- **Automated**: at 390 px (phone) and 820 px (tablet), all nine pages load with no
  horizontal scrolling, no console errors and no server errors (`G:responsive`). At 1440 px,
  every page reached from the sidebar loads with no console errors (`N:links`). The phone
  navigation sheet opens, navigates and closes (`N:mobile`).
- **Reviewed by eye**: screenshots of every page at 1440 px in both themes, 820 px and 390 px,
  taken during the build; the README screenshots were captured from the final build with the
  demo workspace.
- **Colour contrast**: text colours were measured against their backgrounds and meet WCAG AA
  (4.5:1 for body text) in both themes.

## What these results do not cover

- **Windows.** The PowerShell commands in the README were not executed: the audit ran on Linux.
  They use standard `py`, `pip`, `npm` and `uvicorn` invocations, and `package-lock.json`
  includes the Windows builds of the native packages (Rolldown, Tailwind's Oxide engine,
  LightningCSS).
- **GitHub.** The repository is on GitHub and its CI workflow passes there. No pull request
  has been opened or reviewed on GitHub yet: the feature branches were merged locally before
  the repository was published.
- **Browsers and devices.** Only Chromium was automated. Firefox, Safari, touch dragging on a
  phone or tablet, and real screen readers were not tested. Screen reader support (labels,
  live announcements during keyboard moves) is checked through the accessibility tree.
- **Native tooltips.** A few elements show extra detail with the browser's own `title` tooltip
  (for example the full date when hovering a relative time). Browsers do not expose those to
  automation, so they are not counted as interactive elements.
- **Scale and security.** No load testing (API responses took 7–33 ms with the demo data) and
  no security testing. There is no authentication by design; see the README's limitations.
