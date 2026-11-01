import { expect, test } from '@playwright/test'
import { apiCreateProject, apiCreateTask, chooseOption, uid } from './helpers'

test('Journey D: search, filter, clear and sort tasks', async ({ page }) => {
  const project = await apiCreateProject(page.request, { name: uid('Filters project') })
  const prefix = uid('Qx').replace(' ', '')
  const titles = {
    alpha: `${prefix} alpha`,
    beta: `${prefix} beta`,
    gamma: `${prefix} gamma`,
    delta: `${prefix} delta`,
  }
  await apiCreateTask(page.request, {
    project_id: project.id,
    title: titles.alpha,
    priority: 'urgent',
    status: 'todo',
  })
  await apiCreateTask(page.request, {
    project_id: project.id,
    title: titles.beta,
    priority: 'high',
    status: 'in_progress',
  })
  await apiCreateTask(page.request, {
    project_id: project.id,
    title: titles.gamma,
    priority: 'low',
    status: 'done',
  })
  await apiCreateTask(page.request, {
    project_id: project.id,
    title: titles.delta,
    priority: 'urgent',
    status: 'backlog',
  })

  const list = page.getByRole('list', { name: 'Tasks' })
  const visibleTitles = async () =>
    (await list.getByRole('listitem').allInnerTexts()).map((text) =>
      (Object.values(titles).find((title) => text.includes(title)) ?? text).trim(),
    )

  await page.goto('/tasks')
  const search = page.getByRole('searchbox', { name: 'Search tasks' })

  // Search for the four new tasks, then for one of them.
  await search.fill(prefix)
  await expect(page).toHaveURL(new RegExp(`q=${prefix}`))
  await expect(list.getByRole('listitem')).toHaveCount(4)
  await search.fill(`${prefix} beta`)
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).toContainText(titles.beta)

  // Apply filters; the chips show what is applied.
  await search.fill(prefix)
  await expect(list.getByRole('listitem')).toHaveCount(4)
  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by priority' }), 'Urgent')
  await expect(list.getByRole('listitem')).toHaveCount(2)
  expect((await visibleTitles()).sort()).toEqual([titles.alpha, titles.delta].sort())
  const chips = page.getByRole('group', { name: 'Results and active filters' })
  await expect(chips).toContainText('Priority:Urgent')

  await chooseOption(page, page.getByRole('combobox', { name: 'Filter by status' }), 'Done')
  await expect(page.getByText('No tasks match these filters')).toBeVisible()
  await chooseOption(
    page,
    page.getByRole('combobox', { name: 'Filter by status' }),
    'Open (not done)',
  )
  await expect(list.getByRole('listitem')).toHaveCount(2)

  // Remove one chip, then clear everything.
  await chips.getByRole('button', { name: 'Remove filter Priority: Urgent' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(3)
  await chips.getByRole('button', { name: 'Clear all' }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(search).toHaveValue('')

  // Sorting by title, ascending then descending.
  await search.fill(prefix)
  await expect(list.getByRole('listitem')).toHaveCount(4)
  await chooseOption(page, page.getByRole('combobox', { name: 'Sort tasks by' }), 'Sort: Title')
  await expect.poll(visibleTitles).toEqual([titles.alpha, titles.beta, titles.delta, titles.gamma])
  await page.getByRole('button', { name: /^Sort ascending/ }).click()
  await expect.poll(visibleTitles).toEqual([titles.gamma, titles.delta, titles.beta, titles.alpha])
})
