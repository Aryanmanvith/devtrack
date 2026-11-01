import { expect, test, type Page } from '@playwright/test'
import { apiCreateProject, apiCreateTask, apiGet, day, kpiValue, uid } from './helpers'

interface Summary {
  active_projects: number
  open_tasks: number
  completed_this_week: number
  overdue_tasks: number
  week_start: string
  week_end: string
}

async function expectKpisMatchDatabase(page: Page) {
  const { body } = await apiGet<Summary>(page.request, '/api/dashboard/summary')
  expect(await kpiValue(page, 'Active projects')).toBe(body.active_projects)
  expect(await kpiValue(page, 'Open tasks')).toBe(body.open_tasks)
  expect(await kpiValue(page, 'Completed this week')).toBe(body.completed_this_week)
  expect(await kpiValue(page, 'Overdue tasks')).toBe(body.overdue_tasks)
  return body
}

test('Journey F: dashboard metrics, charts, navigation and persistence', async ({ page }) => {
  const project = await apiCreateProject(page.request, { name: uid('Dashboard project') })
  const overdue = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Overdue report'),
    due_date: day(-2),
  })
  const today = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Due today'),
    due_date: day(0),
  })
  const done = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Finished task'),
    status: 'done',
  })

  // KPI values equal the numbers the database reports.
  await page.goto('/')
  const summary = await expectKpisMatchDatabase(page)
  expect(summary.overdue_tasks).toBeGreaterThanOrEqual(1)

  // KPI cards open the filtered records they count.
  await page.getByRole('link', { name: /^Overdue tasks: \d+\./ }).click()
  await expect(page).toHaveURL(/\/tasks\?due=overdue$/)
  const chips = page.getByRole('group', { name: 'Results and active filters' })
  await expect(chips).toContainText('Deadline:Overdue')
  await expect(page.getByRole('list', { name: 'Tasks' })).toContainText(overdue.title)
  await expect(chips).toContainText(`${summary.overdue_tasks} task`)

  await page.goBack()
  await page.getByRole('link', { name: /^Completed this week: \d+\./ }).click()
  await expect(page).toHaveURL(
    new RegExp(`status=done&completed_from=${summary.week_start}&completed_to=${summary.week_end}`),
  )
  await expect(chips).toContainText('Completed:')
  await expect(page.getByRole('list', { name: 'Tasks' })).toContainText(done.title)

  // Chart interactions lead to the matching tasks.
  await page.goto('/')
  await page
    .getByRole('region', { name: 'Task distribution' })
    .getByRole('link', { name: /^Done: / })
    .click()
  await expect(page).toHaveURL(/\/tasks\?status=done$/)
  await page.goto('/')
  await page
    .getByRole('region', { name: 'Completion trend' })
    .getByRole('link', { name: 'View completed tasks' })
    .click()
  await expect(page).toHaveURL(/status=done&completed_from=/)
  await expect(page.getByRole('list', { name: 'Tasks' })).toContainText(done.title)
  await page.goto('/')
  await page
    .getByRole('region', { name: 'Completion trend' })
    .getByRole('radio', { name: 'Last 4 weeks' })
    .click()
  await expect(
    page
      .getByRole('region', { name: 'Completion trend' })
      .getByRole('radio', { name: 'Last 4 weeks' }),
  ).toHaveAttribute('aria-checked', 'true')

  // Upcoming deadlines lists real tasks and opens them.
  const deadlines = page.getByRole('region', { name: 'Upcoming deadlines' })
  await deadlines.getByRole('button', { name: today.title }).click()
  await expect(page.getByRole('dialog', { name: today.title })).toBeVisible()
  await expect(page.getByRole('dialog', { name: today.title })).toContainText('Due today')
  await page.keyboard.press('Escape')

  // Recent activity shows the real creation events and links to the task.
  const activity = page.getByRole('region', { name: 'Recent activity' })
  await activity
    .getByRole('button', { name: `Created task "${done.title}" in ${project.name}` })
    .click()
  await expect(page.getByRole('dialog', { name: done.title })).toBeVisible()
  await page.keyboard.press('Escape')

  // Reload and repeat the checks.
  await page.reload()
  await expectKpisMatchDatabase(page)
})
