import { expect, test } from '@playwright/test'
import { apiCreateProject, apiGet, chooseOption, day, expectToast, kpiValue, uid } from './helpers'

test('Journey B: task lifecycle across My Tasks, Kanban and the dashboard', async ({ page }) => {
  const project = await apiCreateProject(page.request, { name: uid('Tasks project') })
  const title = uid('Write integration tests')

  await page.goto('/')
  const openBefore = await kpiValue(page, 'Open tasks')

  // 1-2. Create a task associated with the project.
  await page.goto('/tasks')
  await page.getByRole('button', { name: 'Create task' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Create task' })
  await dialog.getByLabel('Title').fill(title)
  await chooseOption(page, dialog.getByRole('combobox', { name: 'Project' }), project.name)
  await chooseOption(page, dialog.getByRole('combobox', { name: 'Priority' }), 'High')
  await dialog.getByLabel(/Deadline/).fill(day(1))
  await dialog.getByLabel(/Labels/).fill('testing, e2e')
  await dialog.getByRole('button', { name: 'Create task' }).click()
  await expectToast(page, 'Task created')

  const row = page
    .getByRole('list', { name: 'Tasks' })
    .getByRole('listitem')
    .filter({ hasText: title })
  await expect(row).toBeVisible()
  await expect(row).toContainText('Due tomorrow')

  // 3. Update the status from the list.
  await row.getByRole('button', { name: `Status: To Do. Change status of ${title}` }).click()
  await page.getByRole('menuitemradio', { name: 'In Progress' }).click()
  await expectToast(page, 'Moved to In Progress')

  // 4. The card is in the correct Kanban column.
  await page.goto(`/board?project=${project.id}`)
  const inProgress = page.getByTestId('kanban-column-in_progress')
  await expect(inProgress.getByRole('button', { name: title, exact: true })).toBeVisible()

  // 5. Dashboard metrics changed.
  await page.goto('/')
  expect(await kpiValue(page, 'Open tasks')).toBe(openBefore + 1)

  // 6. Reload and verify persistence.
  await page.goto(`/board?project=${project.id}`)
  await page.reload()
  await expect(
    page.getByTestId('kanban-column-in_progress').getByRole('button', { name: title, exact: true }),
  ).toBeVisible()

  // Drag the card to In Review with the mouse; the move is saved to the backend.
  const card = page.locator('[data-testid^="kanban-card-"]').filter({ hasText: title })
  const taskId = Number((await card.getAttribute('data-testid'))?.replace('kanban-card-', ''))
  const target = page.getByTestId('kanban-column-in_review')
  await target.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'center' }))
  const from = await card.getByText(project.name).boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('Kanban elements not measurable')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + 150, { steps: 20 })
  // While dragging, the board previews the card in the column under the pointer.
  await expect(target.getByTestId(`kanban-card-${taskId}`)).toBeVisible()
  await page.mouse.up()
  await expectToast(page, 'Moved to In Review')
  await expect(target.getByRole('button', { name: title, exact: true })).toBeVisible()
  await expect
    .poll(
      async () =>
        (await apiGet<{ status: string }>(page.request, `/api/tasks/${taskId}`)).body.status,
    )
    .toBe('in_review')
  await page.reload()
  await expect(
    page.getByTestId('kanban-column-in_review').getByRole('button', { name: title, exact: true }),
  ).toBeVisible()

  // 7. Complete the task, then delete it.
  await target.getByRole('button', { name: title, exact: true }).click()
  const drawer = page.getByRole('dialog', { name: title })
  await drawer.getByRole('button', { name: /^Status: In Review/ }).click()
  await page.getByRole('menuitemradio', { name: 'Done' }).click()
  await expectToast(page, 'Task completed')
  await expect(drawer.getByRole('button', { name: /^Status: Done/ })).toBeVisible()
  await expect
    .poll(
      async () =>
        (await apiGet<{ completed_at: string | null }>(page.request, `/api/tasks/${taskId}`)).body
          .completed_at,
    )
    .not.toBeNull()

  await drawer.getByRole('button', { name: 'Delete' }).click()
  await page
    .getByRole('alertdialog', { name: 'Delete this task?' })
    .getByRole('button', { name: 'Delete task' })
    .click()
  await expectToast(page, 'Task deleted')
  await expect(drawer).toBeHidden()
  expect((await apiGet(page.request, `/api/tasks/${taskId}`)).status).toBe(404)

  await page.goto('/')
  expect(await kpiValue(page, 'Open tasks')).toBe(openBefore)
})
