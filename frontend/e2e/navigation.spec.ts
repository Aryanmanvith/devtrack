import { expect, test } from '@playwright/test'
import { apiCreateProject, expectToast, uid } from './helpers'

const PAGES: [string, RegExp][] = [
  ['My Tasks', /^My Tasks$/],
  ['Projects', /^Projects$/],
  ['Kanban Board', /^Kanban Board$/],
  ['Issues', /^Issues$/],
  ['Activity', /^Activity$/],
  ['Analytics', /^Analytics$/],
  ['Settings', /^Settings$/],
  ['Overview', /^(Good|Working late)/],
]

test('every sidebar link opens its page without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const [label, heading] of PAGES) {
    await nav.getByRole('link', { name: new RegExp(`^${label}`) }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
  }
  expect(errors).toEqual([])
})

test('theme and display name persist after a reload and update the interface', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveClass(/light/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/light/)
  await page.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  const name = 'E2E Tester'
  const field = page.getByLabel('Display name')
  const original = await field.inputValue()
  await field.fill(name)
  await page.getByRole('button', { name: 'Save name' }).click()
  await expectToast(page, 'Display name saved')
  await expect(page.getByRole('link', { name: `${name}: open settings` })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name)

  await page.goto('/settings')
  await page.getByLabel('Display name').fill(original)
  await page.getByRole('button', { name: 'Save name' }).click()
  await expectToast(page, 'Display name saved')
})

test('command palette searches records and the deadline bell links to overdue tasks', async ({
  page,
}) => {
  const project = await apiCreateProject(page.request, { name: uid('Palette target') })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const palette = page.getByRole('dialog', { name: 'Search DevTrack' })
  await page.getByRole('button', { name: /^Search \(/ }).click()
  await expect(palette).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
  await page.keyboard.press('Control+k')
  await palette.getByRole('combobox').fill(project.name.split(' ').slice(-1)[0]!)
  await palette.getByRole('option', { name: project.name }).click()
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`))

  await page.getByRole('button', { name: /^Deadline alerts/ }).click()
  await page.getByRole('link', { name: 'View all overdue tasks' }).click()
  await expect(page).toHaveURL(/\/tasks\?due=overdue$/)
})

test('mobile navigation opens, navigates and closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  const sheet = page.getByRole('dialog', { name: 'Navigation' })
  await sheet.getByRole('link', { name: /^Issues/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Issues')
  await expect(sheet).toBeHidden()
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(390)
})
