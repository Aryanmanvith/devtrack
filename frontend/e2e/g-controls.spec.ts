/**
 * Control sweep: exercises every interactive element in the interface inventory
 * (docs/QA_REPORT.md) that the user journeys A-F do not already cover. Each check asserts
 * the visible result and, for changes, the stored state through the API.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  apiCreateIssue,
  apiCreateProject,
  apiCreateTask,
  apiGet,
  chooseOption,
  day,
  expectToast,
  uid,
} from './helpers'

// Each sweep makes dozens of full page loads against the Vite dev server.
test.describe.configure({ timeout: 180_000 })

const h1 = (page: Page) => page.getByRole('heading', { level: 1 })
const chips = (page: Page) => page.getByRole('group', { name: 'Results and active filters' })
const taskList = (page: Page) => page.getByRole('list', { name: 'Tasks', exact: true })

async function taskStatus(page: Page, id: number) {
  return (await apiGet<{ status: string }>(page.request, `/api/tasks/${id}`)).body.status
}

test('app shell: create menu, theme menu, collapsed sidebar, profile, logo and skip link', async ({
  page,
}) => {
  await apiCreateProject(page.request, { name: uid('Shell sweep') })
  await page.goto('/tasks')
  await expect(h1(page)).toHaveText('My Tasks')

  const create = page.getByRole('button', { name: 'Create a task, project or issue' })
  for (const [item, title] of [
    ['Task', 'Create task'],
    ['Project', 'Create project'],
    ['Issue', 'Create issue'],
  ] as const) {
    await create.click()
    await page.getByRole('menuitem', { name: item, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: title })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
  }
  await create.click()
  await page.getByRole('menuitem', { name: 'Task', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Create task' })
    .getByRole('button', { name: 'Close' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Create task' })).toBeHidden()

  await page.getByRole('button', { name: 'Theme: Dark. Change theme' }).click()
  await page.getByRole('menuitemradio', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveClass(/light/)
  await page.getByRole('button', { name: 'Theme: Light. Change theme' }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByText('Issues', { exact: true })).toHaveCount(0)
  await nav.getByRole('link', { name: 'Issues' }).click()
  await expect(h1(page)).toHaveText('Issues')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(nav.getByText('Issues', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: /: open settings$/ }).click()
  await expect(h1(page)).toHaveText('Settings')
  await page.getByRole('link', { name: 'DevTrack overview' }).click()
  await expect(page).toHaveURL(/:5174\/$/)

  await page.reload()
  await expect(h1(page)).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main')).toBeFocused()

  // With no projects yet, the task form explains the order and offers to create a project.
  await page.route('**/api/projects?*', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { items: [], total: 0, limit: 500, offset: 0 } })
      : route.continue(),
  )
  await page.goto('/projects')
  await create.click()
  await page.getByRole('menuitem', { name: 'Task', exact: true }).click()
  const empty = page.getByRole('dialog', { name: 'Create task' })
  await expect(empty.getByText('Create a project first')).toBeVisible()
  await empty.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('dialog', { name: 'Create project' })).toBeVisible()
  await page.unroute('**/api/projects?*')
})

test('dashboard: summary links, KPIs, trend controls, distribution and panel links', async ({
  page,
}) => {
  // The Projects panel lists the five projects with the nearest deadlines.
  const project = await apiCreateProject(page.request, {
    name: uid('Dash sweep'),
    due_date: day(-1),
  })
  const late = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Sweep overdue'),
    due_date: day(-1),
    priority: 'urgent',
  })
  await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Sweep due'),
    due_date: day(0),
  })
  await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Sweep done'),
    status: 'done',
  })

  const back = async () => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /^Open tasks: \d+\./ })).toBeVisible()
  }
  await back()
  const main = page.getByRole('main')

  // Summary sentence links.
  await main.getByRole('link', { name: /^\d+ tasks? (is|are) overdue$/ }).click()
  await expect(page).toHaveURL(/\/tasks\?due=overdue$/)
  await back()
  await main.getByRole('link', { name: /^\d+ tasks? (is|are) due by / }).click()
  await expect(page).toHaveURL(/\/tasks\?due=this_week&status=open$/)
  await expect(chips(page)).toContainText('Deadline:Due this week')
  await back()
  await main.getByRole('link', { name: /^\d+ open tasks?$/ }).click()
  await expect(page).toHaveURL(/\/tasks\?status=open$/)
  await back()
  await main.getByRole('link', { name: /^\d+ active projects?$/ }).click()
  await expect(page).toHaveURL(/\/projects\?status=active$/)
  await back()

  // The other two KPI cards (Overdue and Completed this week are covered by journey F).
  await page.getByRole('link', { name: /^Active projects: \d+\./ }).click()
  await expect(page).toHaveURL(/\/projects\?status=active$/)
  await expect(chips(page)).toContainText('Status:Active')
  await back()
  await page.getByRole('link', { name: /^Open tasks: \d+\./ }).click()
  await expect(page).toHaveURL(/\/tasks\?status=open$/)
  await expect(chips(page)).toContainText('Status:Open')
  await back()

  // Secondary header action.
  await main.getByRole('button', { name: 'Create task', exact: true }).first().click()
  await page
    .getByRole('dialog', { name: 'Create task' })
    .getByRole('button', { name: 'Cancel' })
    .click()

  // Completion trend: range, series toggles, week stepping and the bar for this week.
  const trend = page.getByRole('region', { name: 'Completion trend' })
  await trend.getByRole('radio', { name: 'Last 12 weeks' }).click()
  await expect(
    trend.getByRole('figure', { name: 'Completion trend for the last 12 weeks' }),
  ).toBeVisible()
  await trend.getByRole('radio', { name: 'Last 8 weeks' }).click()
  const completed = trend.getByRole('button', { name: 'Completed' })
  await completed.click()
  await expect(completed).toHaveAttribute('aria-pressed', 'false')
  await completed.click()
  await expect(completed).toHaveAttribute('aria-pressed', 'true')
  const stillOpen = trend.getByRole('button', { name: 'Still open' })
  await stillOpen.click()
  await expect(stillOpen).toHaveAttribute('aria-pressed', 'false')
  await stillOpen.click()
  const detail = trend.locator('p[aria-live="polite"]')
  await expect(detail).toContainText('(this week)')
  await trend.getByRole('button', { name: 'Previous week' }).click()
  await expect(detail).not.toContainText('(this week)')
  await trend.getByRole('button', { name: 'Next week' }).click()
  await expect(detail).toContainText('(this week)')
  await trend.getByRole('button', { name: 'Previous week' }).click()
  await trend.locator('.recharts-bar-rectangle').last().click()
  await expect(detail).toContainText('(this week)')
  await trend.locator('.recharts-bar-rectangle').last().hover()
  await expect(trend.locator('.recharts-tooltip-wrapper')).toContainText('Week of')
  await expect(trend.locator('.recharts-tooltip-wrapper')).toContainText('completed')

  // Distribution: switch to priority, use a legend link, then a chart segment.
  const distribution = page.getByRole('region', { name: 'Task distribution' })
  await distribution.getByRole('radio', { name: 'Priority' }).click()
  await distribution.getByRole('link', { name: /^Urgent: / }).click()
  await expect(page).toHaveURL(/\/tasks\?status=open&priority=urgent$/)
  await expect(taskList(page)).toContainText(late.title)
  await back()
  // A ring segment's bounding-box centre can fall in the hole, so dispatch the click on the path.
  await page
    .getByRole('region', { name: 'Task distribution' })
    .locator('.recharts-pie-sector path')
    .first()
    .dispatchEvent('click')
  await expect(page).toHaveURL(/\/tasks\?status=[a-z_]+$/)
  await back()

  // My tasks panel: quick status, title opens the drawer, project link, View all.
  const myTasks = page.getByRole('region', { name: 'My tasks' })
  const row = myTasks.getByRole('listitem').filter({ hasText: late.title })
  await row.getByRole('button', { name: `Status: To Do. Change status of ${late.title}` }).click()
  await page.getByRole('menuitemradio', { name: 'In Progress' }).click()
  await expectToast(page, 'Moved to In Progress')
  await expect.poll(() => taskStatus(page, late.id)).toBe('in_progress')
  await row.getByRole('button', { name: late.title, exact: true }).click()
  await expect(page.getByRole('dialog', { name: late.title })).toBeVisible()
  await page
    .getByRole('dialog', { name: late.title })
    .getByRole('button', { name: 'Close details' })
    .click()
  await row.getByRole('link', { name: project.name }).click()
  await expect(h1(page)).toHaveText(project.name)
  await back()
  await page
    .getByRole('region', { name: 'My tasks' })
    .getByRole('link', { name: 'View all' })
    .click()
  await expect(page).toHaveURL(/\/tasks\?status=open$/)
  await back()

  // Upcoming deadlines: overdue link and project link.
  const deadlines = page.getByRole('region', { name: 'Upcoming deadlines' })
  await deadlines.getByRole('link', { name: /^View overdue \(\d+\)$/ }).click()
  await expect(page).toHaveURL(/\/tasks\?due=overdue$/)
  await back()
  await page
    .getByRole('region', { name: 'Upcoming deadlines' })
    .getByRole('link', { name: project.name })
    .first()
    .click()
  await expect(h1(page)).toHaveText(project.name)
  await back()

  // Projects panel: card link, actions menu and View all; Recent activity: View all.
  const projects = page.getByRole('region', { name: 'Projects' })
  await projects.getByRole('button', { name: `Actions for ${project.name}` }).click()
  await page.getByRole('menuitem', { name: 'Open Kanban board' }).click()
  await expect(page).toHaveURL(new RegExp(`/board\\?project=${project.id}$`))
  await back()
  await page
    .getByRole('region', { name: 'Projects' })
    .getByRole('link', { name: project.name })
    .click()
  await expect(h1(page)).toHaveText(project.name)
  await back()
  await page
    .getByRole('region', { name: 'Projects' })
    .getByRole('link', { name: 'View all' })
    .click()
  await expect(page).toHaveURL(/\/projects$/)
  await back()
  await page
    .getByRole('region', { name: 'Recent activity' })
    .getByRole('link', { name: 'View all' })
    .click()
  await expect(page).toHaveURL(/\/activity$/)
})

test('projects page: search, status filter, sort, layouts and every card action', async ({
  page,
}) => {
  const prefix = uid('Pz').replace(' ', '')
  const alpha = await apiCreateProject(page.request, {
    name: `${prefix} alpha`,
    status: 'planning',
    due_date: day(-3),
  })
  const beta = await apiCreateProject(page.request, { name: `${prefix} beta`, status: 'active' })

  await page.goto('/projects')
  await page.getByRole('searchbox', { name: 'Search projects' }).fill(prefix)
  await expect(page).toHaveURL(new RegExp(`q=${prefix}`))
  const cards = page.getByRole('list', { name: 'Projects' }).getByRole('listitem')
  await expect(cards).toHaveCount(2)
  // A planning project past its deadline is flagged as overdue on its card.
  await expect(cards.filter({ hasText: alpha.name })).toContainText('Overdue since')

  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by status' }), 'Planning')
  await expect(cards).toHaveCount(1)
  await expect(chips(page)).toContainText('Status:Planning')
  await chips(page).getByRole('button', { name: 'Remove filter Status: Planning' }).click()
  await expect(cards).toHaveCount(2)

  await chooseOption(page, page.getByRole('combobox', { name: 'Sort projects by' }), 'Sort: Name')
  await expect(cards.first()).toContainText(alpha.name)
  await chooseOption(
    page,
    page.getByRole('combobox', { name: 'Sort projects by' }),
    'Sort: Deadline',
  )
  await expect(cards.first()).toContainText(alpha.name)

  await page.getByRole('radio', { name: 'List view' }).click()
  await expect(page).toHaveURL(/view=list/)
  const table = page.getByRole('table')
  await expect(table.getByRole('row')).toHaveCount(3)
  await table.getByRole('link', { name: alpha.name }).click()
  await expect(h1(page)).toHaveText(alpha.name)
  await page.goBack()
  await page.getByRole('radio', { name: 'Grid view' }).click()
  await expect(page.getByRole('list', { name: 'Projects' })).toBeVisible()

  const menu = (name: string) => page.getByRole('button', { name: `Actions for ${name}` }).click()

  await menu(beta.name)
  await page.getByRole('menuitem', { name: 'Open project' }).click()
  await expect(h1(page)).toHaveText(beta.name)
  await page.goBack()
  await menu(beta.name)
  await page.getByRole('menuitem', { name: 'Open Kanban board' }).click()
  await expect(page).toHaveURL(new RegExp(`/board\\?project=${beta.id}$`))
  await page.goBack()

  await menu(beta.name)
  await page.getByRole('menuitem', { name: 'Edit project' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit project' })
  await expect(edit.getByLabel('Name')).toHaveValue(beta.name)
  await edit.getByLabel(/Owner/).fill('Team Beta')
  await chooseOption(page, edit.getByRole('combobox', { name: 'Status' }), 'On Hold')
  await edit.getByRole('radio', { name: 'Teal' }).check({ force: true })
  await edit.getByLabel(/Start date/).fill(day(-10))
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expectToast(page, 'Project saved')
  expect((await apiGet(page.request, `/api/projects/${beta.id}`)).body).toMatchObject({
    owner: 'Team Beta',
    status: 'on_hold',
    color: 'teal',
    start_date: day(-10),
  })

  await menu(beta.name)
  await page.getByRole('menuitem', { name: 'Archive project' }).click()
  await expectToast(page, 'Project archived')
  await expect(cards).toHaveCount(1)
  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by status' }), 'Archived')
  await expect(cards).toHaveCount(1)
  await menu(beta.name)
  await page.getByRole('menuitem', { name: 'Restore project' }).click()
  await expectToast(page, 'Project restored')
  expect(
    (await apiGet<{ status: string }>(page.request, `/api/projects/${beta.id}`)).body.status,
  ).toBe('active')
  // Clear all removes the filters; the chosen sort order stays.
  await chips(page).getByRole('button', { name: 'Clear all' }).click()
  await expect(page).toHaveURL(/\/projects\?sort=due_date$/)
  await expect(page.getByRole('searchbox', { name: 'Search projects' })).toHaveValue('')

  await page.getByRole('searchbox', { name: 'Search projects' }).fill(prefix)
  await expect(cards).toHaveCount(2)
  await menu(alpha.name)
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  const confirm = page.getByRole('alertdialog', { name: `Delete ${alpha.name}?` })
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(confirm).toBeHidden()
  expect((await apiGet(page.request, `/api/projects/${alpha.id}`)).status).toBe(200)
  await menu(alpha.name)
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  await confirm.getByRole('button', { name: 'Delete project' }).click()
  await expectToast(page, 'Project deleted')
  await expect(cards).toHaveCount(1)
  expect((await apiGet(page.request, `/api/projects/${alpha.id}`)).status).toBe(404)

  await page.getByRole('searchbox', { name: 'Search projects' }).fill(`${prefix} nothing`)
  await expect(page.getByText('No projects match these filters')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).toHaveURL(/\/projects\?sort=due_date$/)
})

test('project detail: breadcrumb, board link, status links, tabs, create and row actions', async ({
  page,
}) => {
  const project = await apiCreateProject(page.request, { name: uid('Detail sweep') })
  const todo = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Detail todo'),
  })
  const issue = await apiCreateIssue(page.request, {
    project_id: project.id,
    title: uid('Detail issue'),
  })

  const open = async () => {
    await page.goto(`/projects/${project.id}`)
    await expect(h1(page)).toHaveText(project.name)
  }
  await open()
  await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'Projects' })
    .click()
  await expect(page).toHaveURL(/\/projects$/)
  await open()
  await page.getByRole('link', { name: 'Open board' }).click()
  await expect(page).toHaveURL(new RegExp(`/board\\?project=${project.id}$`))
  await open()
  await page.getByRole('link', { name: 'To Do: 1 task. View them' }).click()
  await expect(page).toHaveURL(new RegExp(`/tasks\\?project=${project.id}&status=todo$`))
  await expect(taskList(page)).toContainText(todo.title)
  await open()

  await page.getByRole('tab', { name: /^Issues/ }).click()
  const projectIssues = page.getByRole('list', { name: `Issues in ${project.name}` })
  await projectIssues.getByRole('button', { name: issue.title, exact: true }).click()
  await expect(page.getByRole('dialog', { name: issue.title })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Activity' }).click()
  await expect(page.getByRole('tabpanel')).toContainText(`Created project "${project.name}"`)
  await page
    .getByRole('tabpanel')
    .getByRole('button', { name: `Created task "${todo.title}" in ${project.name}` })
    .click()
  await expect(page.getByRole('dialog', { name: todo.title })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: /^Tasks/ }).click()

  // The tab row has its own Create task button.
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Create task', exact: true })
    .last()
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Create task' }).getByRole('combobox', { name: 'Project' }),
  ).toContainText(project.name)
  await page
    .getByRole('dialog', { name: 'Create task' })
    .getByRole('button', { name: 'Cancel' })
    .click()

  // Create a task from the page header: the project is preselected.
  await page.getByRole('button', { name: 'Create task', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Create task' })
  await expect(dialog.getByRole('combobox', { name: 'Project' })).toContainText(project.name)
  const title = uid('Detail created')
  await dialog.getByLabel('Title').fill(title)
  await dialog.getByLabel(/Description/).fill('Created from the project page')
  await dialog.getByRole('button', { name: 'Create task' }).click()
  await expectToast(page, 'Task created')
  const tasks = page.getByRole('list', { name: `Tasks in ${project.name}` })
  await expect(tasks).toContainText(title)
  await tasks.getByRole('button', { name: title, exact: true }).click()
  await expect(page.getByRole('dialog', { name: title })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: `More actions for ${project.name}` }).click()
  await page.getByRole('menuitem', { name: 'Open Kanban board' }).click()
  await expect(page).toHaveURL(new RegExp(`/board\\?project=${project.id}$`))
  await page.goBack()
  await expect(h1(page)).toHaveText(project.name)

  // Row controls: completion checkbox and the actions menu.
  await tasks.getByRole('checkbox', { name: `Mark "${todo.title}" as done` }).click()
  await expectToast(page, 'Task completed')
  await expect.poll(() => taskStatus(page, todo.id)).toBe('done')
  await tasks.getByRole('checkbox', { name: `Mark "${todo.title}" as not done` }).click()
  await expectToast(page, 'Task reopened')
  await expect.poll(() => taskStatus(page, todo.id)).toBe('todo')
  await tasks.getByRole('button', { name: `More actions for ${todo.title}` }).click()
  await page.getByRole('menuitem', { name: 'Edit task' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit task' })
  await edit.getByLabel('Title').fill(`${todo.title} edited`)
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expectToast(page, 'Task saved')
  await expect(tasks).toContainText(`${todo.title} edited`)

  // Issues tab: create an issue with the project preselected.
  await page.getByRole('tab', { name: /^Issues/ }).click()
  await page.getByRole('main').getByRole('button', { name: 'Create issue' }).click()
  const issueDialog = page.getByRole('dialog', { name: 'Create issue' })
  await expect(issueDialog.getByRole('combobox', { name: 'Project' })).toContainText(project.name)
  await issueDialog.getByRole('button', { name: 'Cancel' }).click()

  // Archive and restore from the page header.
  await page.getByRole('button', { name: `More actions for ${project.name}` }).click()
  await page.getByRole('menuitem', { name: 'Archive project' }).click()
  await expectToast(page, 'Project archived')
  await expect(page.getByText('This project is archived.')).toBeVisible()
  await page.getByRole('button', { name: `More actions for ${project.name}` }).click()
  await page.getByRole('menuitem', { name: 'Restore project' }).click()
  await expectToast(page, 'Project restored')
  await expect(page.getByText('This project is archived.')).toHaveCount(0)
})

test('my tasks: remaining filters, row menu, drawer controls and completion toggle', async ({
  page,
}) => {
  const project = await apiCreateProject(page.request, { name: uid('Tasks sweep') })
  const label = `lbl${Date.now().toString(36)}`
  const labelled = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Labelled task'),
    labels: [label],
    due_date: day(3),
  })
  const plain = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Plain task'),
  })

  await page.goto('/tasks')
  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by project' }), project.name)
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`))
  await expect(taskList(page).getByRole('listitem')).toHaveCount(2)
  await expect(chips(page)).toContainText(`Project:${project.name}`)

  await chooseOption(
    page,
    page.getByRole('combobox', { name: 'Filter by deadline' }),
    'No deadline',
  )
  await expect(taskList(page).getByRole('listitem')).toHaveCount(1)
  await expect(taskList(page)).toContainText(plain.title)
  await chips(page).getByRole('button', { name: 'Remove filter Deadline: No deadline' }).click()

  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by label' }), `${label} (1)`)
  await expect(taskList(page).getByRole('listitem')).toHaveCount(1)
  await expect(chips(page)).toContainText(`Label:${label}`)
  await chips(page)
    .getByRole('button', { name: `Remove filter Label: ${label}` })
    .click()

  // Search field clear button.
  const search = page.getByRole('searchbox', { name: 'Search tasks' })
  await search.fill(plain.title)
  await expect(taskList(page).getByRole('listitem')).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(search).toHaveValue('')
  await expect(taskList(page).getByRole('listitem')).toHaveCount(2)

  const row = taskList(page).getByRole('listitem').filter({ hasText: labelled.title })
  // Priority sort: urgent first.
  await chooseOption(page, page.getByRole('combobox', { name: 'Sort tasks by' }), 'Sort: Priority')
  await expect(page).toHaveURL(/sort=priority/)

  // Row menu: details, edit, delete (cancelled).
  await row.getByRole('button', { name: `More actions for ${labelled.title}` }).click()
  await page.getByRole('menuitem', { name: 'Open details' }).click()
  const drawer = page.getByRole('dialog', { name: labelled.title })
  await expect(drawer).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`task=${labelled.id}`))

  // Drawer controls: priority, edit, project link and close.
  await drawer.getByRole('button', { name: /^Priority: Medium/ }).click()
  await page.getByRole('menuitemradio', { name: 'Urgent' }).click()
  await expectToast(page, 'Priority updated')
  await expect
    .poll(
      async () =>
        (await apiGet<{ priority: string }>(page.request, `/api/tasks/${labelled.id}`)).body
          .priority,
    )
    .toBe('urgent')
  await drawer.getByRole('button', { name: 'Edit' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit task' })
  await chooseOption(page, edit.getByRole('combobox', { name: 'Status' }), 'In Review')
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expectToast(page, 'Task saved')
  await expect.poll(() => taskStatus(page, labelled.id)).toBe('in_review')
  await drawer.getByRole('button', { name: 'Close details' }).click()
  await expect(drawer).toBeHidden()
  await expect(page).not.toHaveURL(/task=/)

  await row.getByRole('button', { name: labelled.title, exact: true }).click()
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()

  await row.getByRole('button', { name: `More actions for ${labelled.title}` }).click()
  await page.getByRole('menuitem', { name: 'Edit task' }).click()
  await page
    .getByRole('dialog', { name: 'Edit task' })
    .getByRole('button', { name: 'Cancel' })
    .click()

  // Labels used before are offered as one-click suggestions.
  await taskList(page)
    .getByRole('listitem')
    .filter({ hasText: plain.title })
    .getByRole('button', { name: `More actions for ${plain.title}` })
    .click()
  await page.getByRole('menuitem', { name: 'Edit task' }).click()
  const labelEdit = page.getByRole('dialog', { name: 'Edit task' })
  const suggestion = labelEdit.getByText('Used before:').locator('..').getByRole('button').first()
  const suggested = (await suggestion.textContent())?.trim() ?? ''
  await suggestion.click()
  await expect(labelEdit.getByLabel(/Labels/)).toHaveValue(suggested)
  await labelEdit.getByRole('button', { name: 'Save changes' }).click()
  await expectToast(page, 'Task saved')
  await expect
    .poll(
      async () =>
        (await apiGet<{ labels: string[] }>(page.request, `/api/tasks/${plain.id}`)).body.labels,
    )
    .toEqual([suggested])

  await row.getByRole('button', { name: `More actions for ${labelled.title}` }).click()
  await page.getByRole('menuitem', { name: 'Delete task' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Delete this task?' })
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(confirm).toBeHidden()
  expect((await apiGet(page.request, `/api/tasks/${labelled.id}`)).status).toBe(200)

  // Completion checkbox in the list, both ways.
  const plainRow = taskList(page).getByRole('listitem').filter({ hasText: plain.title })
  await plainRow.getByRole('checkbox', { name: `Mark "${plain.title}" as done` }).click()
  await expectToast(page, 'Task completed')
  await expect.poll(() => taskStatus(page, plain.id)).toBe('done')
  await plainRow.getByRole('checkbox', { name: `Mark "${plain.title}" as not done` }).click()
  await expectToast(page, 'Task reopened')
  await expect.poll(() => taskStatus(page, plain.id)).toBe('todo')

  // Project link in the row; drawer project link.
  await plainRow.getByRole('link', { name: project.name }).click()
  await expect(h1(page)).toHaveText(project.name)
  await page.goto(`/tasks?task=${plain.id}`)
  await page
    .getByRole('dialog', { name: plain.title })
    .getByRole('link', { name: project.name })
    .click()
  await expect(h1(page)).toHaveText(project.name)
})

test('kanban: project filter, card filter, column create, keyboard move and card menu', async ({
  page,
}) => {
  const project = await apiCreateProject(page.request, { name: uid('Board sweep') })
  const first = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Board card one'),
  })
  const second = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Board card two'),
  })

  await page.goto('/board')
  await chooseOption(page, page.getByRole('combobox', { name: 'Show project' }), project.name)
  await expect(page).toHaveURL(new RegExp(`/board\\?project=${project.id}$`))
  await expect(chips(page)).toContainText(`Project:${project.name}`)
  const todo = page.getByTestId('kanban-column-todo')
  await expect(todo.locator('[data-testid^="kanban-card-"]')).toHaveCount(2)

  await page.getByRole('searchbox', { name: 'Filter cards' }).fill('card two')
  await expect(todo.locator('[data-testid^="kanban-card-"]')).toHaveCount(1)
  await expect(todo).toContainText(second.title)
  await page.getByRole('searchbox', { name: 'Filter cards' }).fill('')
  await expect(todo.locator('[data-testid^="kanban-card-"]')).toHaveCount(2)

  // Column "+" opens the form with that status and the selected project.
  await page.getByRole('button', { name: 'Create task in In Review' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create task' })
  await expect(dialog.getByRole('combobox', { name: 'Status' })).toContainText('In Review')
  await expect(dialog.getByRole('combobox', { name: 'Project' })).toContainText(project.name)
  const title = uid('Board created')
  await dialog.getByLabel('Title').fill(title)
  await dialog.getByRole('button', { name: 'Create task' }).click()
  await expectToast(page, 'Task created')
  await expect(page.getByTestId('kanban-column-in_review')).toContainText(title)

  // Header "Create task" also preselects the project.
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Create task', exact: true })
    .first()
    .click()
  await expect(dialog.getByRole('combobox', { name: 'Project' })).toContainText(project.name)
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  // Escape cancels a keyboard move and leaves the card where it was.
  await page.getByRole('button', { name: `Move task ${second.title}` }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByText(`Task ${second.title} is over To Do.`)).toBeAttached()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText(`Task ${second.title} is over In Progress.`)).toBeAttached()
  await page.keyboard.press('Escape')
  await expect(
    page.getByText(`Moving cancelled. Task ${second.title} was not moved.`),
  ).toBeAttached()
  await expect(todo).toContainText(second.title)
  expect(await taskStatus(page, second.id)).toBe('todo')

  // Keyboard move with the drag handle: Space, ArrowRight, Space.
  // dnd-kit listens for the next key only after it has announced the pick-up, so the test
  // waits for each screen reader announcement, as a person would wait for the card to move.
  const handle = page.getByRole('button', { name: `Move task ${first.title}` })
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(page.getByText(`Task ${first.title} is over To Do.`)).toBeAttached()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText(`Task ${first.title} is over In Progress.`)).toBeAttached()
  await page.keyboard.press('Space')
  await expectToast(page, 'Moved to In Progress')
  await expect.poll(() => taskStatus(page, first.id)).toBe('in_progress')
  await expect(page.getByTestId('kanban-column-in_progress')).toContainText(first.title)

  // Card menu: details drawer.
  await page.getByRole('button', { name: `More actions for ${second.title}` }).click()
  await page.getByRole('menuitem', { name: 'Open details' }).click()
  await expect(page.getByRole('dialog', { name: second.title })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('link', { name: 'Open project' }).click()
  await expect(h1(page)).toHaveText(project.name)

  await page.goto(`/board?project=${project.id}`)
  await page.getByRole('searchbox', { name: 'Filter cards' }).fill('card')
  await expect(chips(page)).toContainText('Cards matching')
  await chips(page).getByRole('button', { name: 'Clear all' }).click()
  await expect(page).toHaveURL(/\/board$/)
  await expect(page.getByRole('searchbox', { name: 'Filter cards' })).toHaveValue('')
})

test('issues: tabs, filters, sort, row menu and drawer actions', async ({ page }) => {
  const project = await apiCreateProject(page.request, { name: uid('Issue sweep') })
  const prefix = uid('Iz').replace(' ', '')
  const bug = await apiCreateIssue(page.request, {
    project_id: project.id,
    title: `${prefix} bravo bug`,
    type: 'bug',
    priority: 'high',
  })
  const feature = await apiCreateIssue(page.request, {
    project_id: project.id,
    title: `${prefix} alpha feature`,
    type: 'feature',
    priority: 'low',
  })
  const issues = page.getByRole('list', { name: 'Issues' })
  const rows = issues.getByRole('listitem')

  await page.goto('/issues')
  await page.getByRole('searchbox', { name: 'Search issues' }).fill(prefix)
  await expect(rows).toHaveCount(2)
  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by type' }), 'Bug')
  await expect(rows).toHaveCount(1)
  await expect(issues).toContainText(bug.title)
  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by type' }), /^All/)
  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by priority' }), 'Low')
  await expect(rows).toHaveCount(1)
  await expect(issues).toContainText(feature.title)
  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by priority' }), /^All/)
  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by project' }), project.name)
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`))
  await expect(rows).toHaveCount(2)
  await chooseOption(page, page.getByRole('combobox', { name: 'Sort issues by' }), 'Sort: Title')
  await expect(rows.first()).toContainText(feature.title)

  const row = rows.filter({ hasText: bug.title })
  const menu = () => row.getByRole('button', { name: `More actions for ${bug.title}` }).click()
  const statusOf = async () =>
    (await apiGet<{ status: string }>(page.request, `/api/issues/${bug.id}`)).body.status

  await menu()
  await page.getByRole('menuitem', { name: 'Edit issue' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit issue' })
  await edit.getByLabel(/Description/).fill('Reproduced on Chrome and Firefox')
  await chooseOption(page, edit.getByRole('combobox', { name: 'Priority' }), 'Urgent')
  await chooseOption(page, edit.getByRole('combobox', { name: 'Status' }), 'In Progress')
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expectToast(page, 'Issue saved')
  await expect
    .poll(
      async () =>
        (await apiGet<{ priority: string }>(page.request, `/api/issues/${bug.id}`)).body.priority,
    )
    .toBe('urgent')
  await expect.poll(statusOf).toBe('in_progress')

  await row.getByRole('link', { name: project.name }).click()
  await expect(h1(page)).toHaveText(project.name)
  await page.goBack()
  await expect(row).toBeVisible()

  await menu()
  await page.getByRole('menuitem', { name: 'Close without fixing' }).click()
  await expectToast(page, 'Issue closed')
  await expect.poll(statusOf).toBe('closed')
  await page.getByRole('tab', { name: /^All/ }).click()
  await expect(row).toBeVisible()
  await menu()
  await page.getByRole('menuitem', { name: 'Reopen' }).click()
  await expectToast(page, 'Issue reopened')
  await expect.poll(statusOf).toBe('open')
  await menu()
  await page.getByRole('menuitem', { name: 'Resolve' }).click()
  await expectToast(page, 'Issue resolved')
  await expect.poll(statusOf).toBe('resolved')
  await menu()
  await page.getByRole('menuitem', { name: 'Reopen' }).click()
  await expectToast(page, 'Issue reopened')

  await menu()
  await page.getByRole('menuitem', { name: 'Delete issue' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Delete this issue?' })
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  expect((await apiGet(page.request, `/api/issues/${bug.id}`)).status).toBe(200)

  // Drawer: start progress, close, reopen, priority, edit, project link, close button.
  await menu()
  await page.getByRole('menuitem', { name: 'Open details' }).click()
  const drawer = page.getByRole('dialog', { name: bug.title })
  await drawer.getByRole('button', { name: 'Start progress' }).click()
  await expectToast(page, 'Issue marked in progress')
  await expect.poll(statusOf).toBe('in_progress')
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await expectToast(page, 'Issue closed')
  await expect.poll(statusOf).toBe('closed')
  await drawer.getByRole('button', { name: 'Reopen' }).click()
  await expectToast(page, 'Issue reopened')
  await drawer.getByRole('button', { name: /^Priority: Urgent/ }).click()
  await page.getByRole('menuitemradio', { name: 'Medium' }).click()
  await expectToast(page, 'Priority updated')
  await drawer.getByRole('button', { name: 'Edit' }).click()
  await page
    .getByRole('dialog', { name: 'Edit issue' })
    .getByRole('button', { name: 'Cancel' })
    .click()
  await drawer.getByRole('button', { name: 'Close details' }).click()
  await expect(drawer).toBeHidden()
  await page.goto(`/issues?issue=${bug.id}`)
  await page
    .getByRole('dialog', { name: bug.title })
    .getByRole('link', { name: project.name })
    .click()
  await expect(h1(page)).toHaveText(project.name)

  // Tabs and Clear all.
  await page.goto(`/issues?q=${prefix}&state=closed`)
  await expect(page.getByText('No issues match these filters')).toBeVisible()
  await page.getByRole('tab', { name: /^Open/ }).click()
  await expect(rows).toHaveCount(2)
  await chips(page).getByRole('button', { name: 'Clear all' }).click()
  await expect(page).toHaveURL(/\/issues$/)
})

test('activity: type filter, search, project filter, load more and entity links', async ({
  page,
}) => {
  const project = await apiCreateProject(page.request, { name: uid('Activity sweep') })
  const titles: string[] = []
  for (let index = 0; index < 26; index += 1) {
    const task = await apiCreateTask(page.request, {
      project_id: project.id,
      title: `${project.name} task ${index + 1}`,
    })
    titles.push(task.title)
  }
  const issue = await apiCreateIssue(page.request, {
    project_id: project.id,
    title: `${project.name} issue`,
    type: 'bug',
  })

  await page.goto('/activity')
  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by project' }), project.name)
  await expect(page).toHaveURL(new RegExp(`project=${project.id}`))
  const feed = page.getByRole('main').getByRole('listitem')
  await expect(feed).toHaveCount(25)
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(feed).toHaveCount(28)
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0)

  await page.getByRole('radio', { name: 'Projects' }).click()
  await expect(page).toHaveURL(/type=project/)
  await expect(feed).toHaveCount(1)
  await page.getByRole('radio', { name: 'Tasks' }).click()
  await expect(feed).toHaveCount(25)
  await page.getByRole('radio', { name: 'Issues' }).click()
  await expect(feed).toHaveCount(1)
  await page.getByRole('button', { name: `Opened bug "${issue.title}" in ${project.name}` }).click()
  await expect(page.getByRole('dialog', { name: issue.title })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('radio', { name: 'System' }).click()
  await expect(page).toHaveURL(/type=system/)
  await expect(page.getByText('No activity matches these filters')).toBeVisible()
  await page.getByRole('radio', { name: 'All' }).click()

  await page.getByRole('searchbox', { name: 'Search activity' }).fill(`${project.name} task 26`)
  await expect(feed).toHaveCount(1)
  await page
    .getByRole('button', { name: `Created task "${titles[25]}" in ${project.name}` })
    .click()
  await expect(page.getByRole('dialog', { name: titles[25] })).toBeVisible()
  await page.keyboard.press('Escape')

  await chips(page).getByRole('button', { name: 'Clear all' }).click()
  await expect(page).toHaveURL(/\/activity$/)
  await expect(page.getByRole('searchbox', { name: 'Search activity' })).toHaveValue('')
  await page.getByRole('radio', { name: 'Projects' }).click()
  await page.getByRole('button', { name: `Created project "${project.name}"` }).click()
  await expect(h1(page)).toHaveText(project.name)
})

test('analytics: project filter, ranges, series and every breakdown link', async ({ page }) => {
  const project = await apiCreateProject(page.request, { name: uid('Analytics sweep') })
  await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('An todo'),
    priority: 'high',
  })
  await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('An done'),
    status: 'done',
  })
  await apiCreateIssue(page.request, { project_id: project.id, title: uid('An bug'), type: 'bug' })

  const open = async () => {
    await page.goto(`/analytics?project=${project.id}`)
    await expect(page.getByRole('link', { name: /^Open tasks/ })).toBeVisible()
  }
  await page.goto('/analytics')
  await chooseOption(page, page.getByRole('combobox', { name: 'Analyse project' }), project.name)
  await expect(page).toHaveURL(new RegExp(`/analytics\\?project=${project.id}$`))

  for (const weeks of [4, 8, 26, 12]) {
    await page.getByRole('radio', { name: `Last ${weeks} weeks` }).click()
    await expect(
      page.getByRole('figure', { name: `Weekly completion trend for the last ${weeks} weeks` }),
    ).toBeVisible()
  }
  await page
    .getByRole('figure', { name: /Weekly completion trend/ })
    .locator('.recharts-bar-rectangle')
    .last()
    .click()
  await expect(page).toHaveURL(
    new RegExp(`/tasks\\?status=done&completed_from=.+&completed_to=.+&project=${project.id}$`),
  )
  await page.goBack()
  for (const series of ['Completed', 'Created', 'Still open']) {
    const toggle = page.getByRole('button', { name: series, exact: true })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  }

  const checks: [RegExp, RegExp][] = [
    [/^Completion rate/, new RegExp(`/tasks\\?status=done&project=${project.id}$`)],
    [/^Open tasks/, new RegExp(`/tasks\\?status=open&project=${project.id}$`)],
    [/^Overdue tasks/, new RegExp(`/tasks\\?due=overdue&project=${project.id}$`)],
    [/^Open issues/, new RegExp(`/issues\\?state=open&project=${project.id}$`)],
    [/^Completed in \d+ weeks/, /\/tasks\?status=done&completed_from=.*&completed_to=.*&project=/],
    [/^Issues resolved in/, new RegExp(`/issues\\?state=closed&project=${project.id}$`)],
  ]
  await open()
  for (const [name, url] of checks) {
    await page.getByRole('link', { name }).click()
    await expect(page).toHaveURL(url)
    await open()
  }
  const region = (name: string) => page.getByRole('region', { name })
  await region('Tasks by status')
    .getByRole('link', { name: /^To Do/ })
    .click()
  await expect(page).toHaveURL(new RegExp(`/tasks\\?status=todo&project=${project.id}$`))
  await open()
  await region('Open tasks by priority').getByRole('link', { name: /^High/ }).click()
  await expect(page).toHaveURL(
    new RegExp(`/tasks\\?status=open&priority=high&project=${project.id}$`),
  )
  await open()
  await region('Issues by type').getByRole('link', { name: /^Bug/ }).click()
  await expect(page).toHaveURL(/\/issues\?.*type=bug/)
  await open()
  await region('Completion calendar')
    .getByRole('link', { name: /1 task completed\. View them$/ })
    .first()
    .click()
  await expect(page).toHaveURL(
    /\/tasks\?status=done&completed_from=(\d{4}-\d\d-\d\d)&completed_to=\1/,
  )
  await open()
  await region('Project progress')
    .getByRole('link', { name: new RegExp(`^${project.name}`) })
    .click()
  await expect(h1(page)).toHaveText(project.name)
})

test('settings: week start, demo data load and removal, demo notice and API docs link', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.getByRole('radio', { name: 'System' }).click()
  await expect(page.locator('html')).toHaveClass(/light/)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: 'Dark' }).click()

  await page.getByRole('radio', { name: 'Sunday' }).click()
  await expectToast(page, 'Week start saved')
  await expect
    .poll(
      async () =>
        (await apiGet<{ week_start: string }>(page.request, '/api/preferences')).body.week_start,
    )
    .toBe('sunday')
  const summary = await apiGet<{ week_start: string }>(page.request, '/api/dashboard/summary')
  expect(new Date(`${summary.body.week_start}T00:00:00Z`).getUTCDay()).toBe(0)
  await page.getByRole('radio', { name: 'Monday' }).click()
  await expectToast(page, 'Week start saved')

  const docs = page.getByRole('link', { name: 'Open API documentation' })
  await expect(docs).toHaveAttribute('href', 'http://127.0.0.1:8001/docs')
  expect((await page.request.get('http://127.0.0.1:8001/docs')).status()).toBe(200)

  // Demo data: load, see the dashboard notice, use its link, dismiss it, then remove the data.
  await page.getByRole('button', { name: 'Load demo data' }).click()
  await expectToast(page, 'Demo data loaded')
  expect(
    (await apiGet<{ has_demo_data: boolean }>(page.request, '/api/demo-data')).body.has_demo_data,
  ).toBe(true)
  await page.goto('/')
  await page.getByRole('link', { name: 'Manage demo data' }).click()
  await expect(page).toHaveURL(/\/settings#demo-data$/)
  await page.goto('/')
  await page.getByRole('button', { name: 'Dismiss demo data notice' }).click()
  await expect(page.getByRole('link', { name: 'Manage demo data' })).toHaveCount(0)
  await page.reload()
  await expect(h1(page)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Manage demo data' })).toHaveCount(0)

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Remove demo data' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Remove all demo data?' })
  await confirm.getByRole('button', { name: 'Remove demo data' }).click()
  await expectToast(page, 'Demo data removed')
  expect(
    (await apiGet<{ has_demo_data: boolean }>(page.request, '/api/demo-data')).body.has_demo_data,
  ).toBe(false)
  await expect(page.getByRole('button', { name: 'Load demo data' })).toBeVisible()
})

test('command palette results and quick actions; deadline bell items', async ({ page }) => {
  const project = await apiCreateProject(page.request, { name: uid('Palette sweep') })
  const task = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Palette task'),
    due_date: day(-1),
  })
  const issue = await apiCreateIssue(page.request, {
    project_id: project.id,
    title: uid('Palette issue'),
  })
  await page.goto('/')
  await expect(h1(page)).toBeVisible()
  const palette = page.getByRole('dialog', { name: 'Search DevTrack' })
  const input = palette.getByRole('combobox')

  await page.keyboard.press('Control+k')
  await input.fill(task.title)
  await palette.getByRole('option', { name: new RegExp(task.title) }).click()
  await expect(page.getByRole('dialog', { name: task.title })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.keyboard.press('Control+k')
  await input.fill(issue.title)
  await palette.getByRole('option', { name: new RegExp(issue.title) }).click()
  await expect(page.getByRole('dialog', { name: issue.title })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.keyboard.press('Control+k')
  await input.fill('zzzz-no-such-record')
  await expect(palette.getByText(/No projects, tasks or issues match/)).toBeVisible()
  await input.fill('')
  await palette.getByRole('option', { name: 'Create issue' }).click()
  await expect(page.getByRole('dialog', { name: 'Create issue' })).toBeVisible()
  await page.keyboard.press('Escape')
  for (const action of ['Create task', 'Create project']) {
    await page.keyboard.press('Control+k')
    await palette.getByRole('option', { name: action }).click()
    await expect(page.getByRole('dialog', { name: action })).toBeVisible()
    await page.keyboard.press('Escape')
  }
  const destinations: [string, string | RegExp][] = [
    ['My Tasks', 'My Tasks'],
    ['Projects', 'Projects'],
    ['Kanban Board', 'Kanban Board'],
    ['Issues', 'Issues'],
    ['Activity', 'Activity'],
    ['Analytics', 'Analytics'],
    ['Settings', 'Settings'],
    ['Overview', /^(Good|Working late)/],
  ]
  for (const [item, heading] of destinations) {
    await page.keyboard.press('Control+k')
    await palette.getByRole('option', { name: item, exact: true }).click()
    await expect(h1(page)).toHaveText(heading)
  }

  await page.getByRole('button', { name: /^Deadline alerts/ }).click()
  await page
    .getByRole('dialog', { name: 'Deadline alerts' })
    .getByRole('button', { name: new RegExp(task.title) })
    .click()
  await expect(page.getByRole('dialog', { name: task.title })).toBeVisible()
})

test('empty states: every call to action opens the right form', async ({ page }) => {
  const project = await apiCreateProject(page.request, { name: uid('Empty states') })
  const opens = async (button: Locator, dialog: string) => {
    await button.click()
    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: dialog })).toBeHidden()
  }

  // A project without tasks or issues (real data).
  await page.goto(`/projects/${project.id}`)
  const panel = page.getByRole('tabpanel')
  await expect(panel.getByText('No tasks in this project')).toBeVisible()
  await opens(panel.getByRole('button', { name: 'Create task' }), 'Create task')
  await page.getByRole('tab', { name: /^Issues/ }).click()
  await expect(panel.getByText('No issues reported')).toBeVisible()
  await opens(panel.getByRole('button', { name: 'Create issue' }), 'Create issue')

  // Empty lists everywhere else, simulated by answering list requests with no records.
  const empty = (pattern: RegExp) =>
    page.route(pattern, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { items: [], total: 0, limit: 50, offset: 0 } })
        : route.continue(),
    )
  await empty(/\/api\/tasks\?/)
  await empty(/\/api\/issues\?/)
  await page.route(/\/api\/dashboard\/task-distribution/, (route) =>
    route.fulfill({ json: { total: 0, open_total: 0, by_status: [], by_priority: [] } }),
  )
  const main = page.getByRole('main')
  await page.goto('/tasks')
  await expect(page.getByText('No tasks yet')).toBeVisible()
  await opens(main.getByRole('button', { name: 'Create task' }).last(), 'Create task')
  await page.goto('/board')
  await expect(page.getByText('The board is empty')).toBeVisible()
  await opens(main.getByRole('button', { name: 'Create task' }).last(), 'Create task')
  await page.goto('/issues')
  await expect(page.getByText('No open issues')).toBeVisible()
  await opens(main.getByRole('button', { name: 'Create issue' }).last(), 'Create issue')
  await page.goto('/')
  const myTasks = page.getByRole('region', { name: 'My tasks' })
  await expect(myTasks.getByText('No open tasks')).toBeVisible()
  await opens(myTasks.getByRole('button', { name: 'Create task' }), 'Create task')
  const distribution = page.getByRole('region', { name: 'Task distribution' })
  await expect(distribution.getByText('No tasks yet')).toBeVisible()
  await opens(distribution.getByRole('button', { name: 'Create task' }), 'Create task')

  await empty(/\/api\/projects\?/)
  await page.goto('/projects')
  await expect(page.getByText('No projects yet')).toBeVisible()
  await opens(main.getByRole('button', { name: 'Create project' }).last(), 'Create project')
  await page.goto('/')
  const projects = page.getByRole('region', { name: 'Projects' })
  await expect(projects.getByText('No active projects')).toBeVisible()
  await opens(projects.getByRole('button', { name: 'Create project' }), 'Create project')
})

test('no-match states: Clear filters resets tasks, issues and activity', async ({ page }) => {
  for (const [path, message] of [
    ['/tasks', 'No tasks match these filters'],
    ['/issues', 'No issues match these filters'],
    ['/activity', 'No activity matches these filters'],
  ] as const) {
    await page.goto(`${path}?q=zzzz-no-such-record`)
    await expect(page.getByText(message)).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByText(message)).toHaveCount(0)
  }
})

test('responsive: every page fits phone and tablet widths without console errors', async ({
  page,
}) => {
  const project = await apiCreateProject(page.request, { name: uid('Responsive') })
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  const failed: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 500) failed.push(`${response.status()} ${response.url()}`)
  })
  const paths = [
    '/',
    '/tasks',
    '/projects',
    `/projects/${project.id}`,
    '/board',
    '/issues',
    '/activity',
    '/analytics',
    '/settings',
  ]
  for (const width of [390, 820]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of paths) {
      await page.goto(path)
      await expect(h1(page)).toBeVisible()
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0)
    }
  }
  expect(errors).toEqual([])
  expect(failed).toEqual([])
})
