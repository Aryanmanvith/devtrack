import { expect, test } from '@playwright/test'
import { apiCreateProject, apiCreateTask, apiGet, expectToast, uid } from './helpers'

const serverError = {
  status: 500,
  contentType: 'application/json',
  body: JSON.stringify({
    detail: 'Unexpected server error. Check the backend logs.',
    code: 'internal_error',
    errors: [],
  }),
}

test('Journey E1: invalid form data is caught before anything is sent', async ({ page }) => {
  await apiCreateProject(page.request)
  const posts: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/')) posts.push(request.url())
  })

  await page.goto('/tasks')
  await page.getByRole('button', { name: 'Create task' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Create task' })
  await dialog.getByLabel(/Labels/).fill('not valid!')
  await dialog.getByRole('button', { name: 'Create task' }).click()
  await expect(dialog.getByText('Give the task a title.')).toBeVisible()
  await expect(dialog.getByText('Choose a project.')).toBeVisible()
  await expect(dialog.getByText(/Labels can contain letters, numbers and hyphens/)).toBeVisible()
  expect(posts).toEqual([])
})

test('Journey E2: server-side validation keeps what the user typed', async ({ page }) => {
  const existing = await apiCreateProject(page.request, { name: uid('Duplicate me') })
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Create project' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Create project' })
  await dialog.getByLabel('Name').fill(existing.name.toUpperCase())
  await dialog.getByLabel(/Description/).fill('This text must survive the error')
  await dialog.getByRole('button', { name: 'Create project' }).click()

  await expect(
    dialog.getByRole('alert').filter({ hasText: 'already exists' }).first(),
  ).toBeVisible()
  await expect(dialog.getByLabel('Name')).toHaveValue(existing.name.toUpperCase())
  await expect(dialog.getByLabel(/Description/)).toHaveValue('This text must survive the error')
  await expect(page.getByText('Project created')).toHaveCount(0)
})

test('Journey E3: nonexistent resources show a clear message', async ({ page }) => {
  await page.goto('/projects/999999')
  await expect(page.getByText('Project not found')).toBeVisible()
  await page.getByRole('link', { name: 'Back to projects' }).click()
  await expect(page).toHaveURL(/\/projects$/)

  await page.goto('/tasks?task=999999')
  await expect(page.getByRole('dialog').getByText('This task no longer exists')).toBeVisible()

  await page.goto('/does-not-exist')
  await expect(page.getByText('This page does not exist')).toBeVisible()
  await page.getByRole('link', { name: 'Go to overview' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('Journey E4: a failing API is reported and the UI does not pretend it worked', async ({
  page,
}) => {
  const project = await apiCreateProject(page.request)
  const task = await apiCreateTask(page.request, {
    project_id: project.id,
    title: uid('Fragile task'),
  })

  // Status changes fail on the server: the change is undone and no success is shown.
  await page.route('**/api/tasks/*', (route) =>
    route.request().method() === 'PATCH' ? route.fulfill(serverError) : route.continue(),
  )
  await page.goto(`/tasks?project=${project.id}`)
  const row = page
    .getByRole('list', { name: 'Tasks' })
    .getByRole('listitem')
    .filter({ hasText: task.title })
  await row.getByRole('button', { name: `Status: To Do. Change status of ${task.title}` }).click()
  await page.getByRole('menuitemradio', { name: 'Done' }).click()
  await expectToast(page, 'Could not change the status')
  await expect(page.getByText(/The change was undone/)).toBeVisible()
  await expect(
    row.getByRole('button', { name: `Status: To Do. Change status of ${task.title}` }),
  ).toBeVisible()
  await expect(page.getByText('Task completed')).toHaveCount(0)
  expect(
    (await apiGet<{ status: string }>(page.request, `/api/tasks/${task.id}`)).body.status,
  ).toBe('todo')
  await page.unroute('**/api/tasks/*')

  // Creating fails: the dialog stays open with the typed values and an explanation.
  await page.route('**/api/projects', (route) =>
    route.request().method() === 'POST' ? route.fulfill(serverError) : route.continue(),
  )
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Create project' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Create project' })
  await dialog.getByLabel('Name').fill('Will not be saved')
  await dialog.getByRole('button', { name: 'Create project' }).click()
  await expect(
    dialog.getByRole('alert').filter({ hasText: 'Unexpected server error' }),
  ).toBeVisible()
  await expect(dialog.getByLabel('Name')).toHaveValue('Will not be saved')
  await expect(page.getByText('Project created')).toHaveCount(0)
  await page.unroute('**/api/projects')

  // The API is unreachable: a clear message and a working retry.
  await page.route('**/api/issues?**', (route) => route.abort())
  await page.goto('/issues')
  await expect(page.getByText('The API is not reachable')).toBeVisible()
  await page.unroute('**/api/issues?**')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('The API is not reachable')).toHaveCount(0)
})
