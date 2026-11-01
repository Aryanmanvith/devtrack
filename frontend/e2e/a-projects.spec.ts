import { expect, test } from '@playwright/test'
import { apiGet, day, expectToast, uid } from './helpers'

test('Journey A: create, view, edit, persist and delete a project', async ({ page }) => {
  const name = uid('Robotics Club')

  // 1. Open the dashboard.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good|Working late/)

  // 2. Create a project from the dashboard.
  await page.getByRole('button', { name: 'Create project' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Create project' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByLabel(/Description/).fill('Line-following robot for the spring showcase')
  await dialog.getByRole('button', { name: 'Create project' }).click()
  await expectToast(page, 'Project created')
  await expect(dialog).toBeHidden()

  // 3. It appears in the project list.
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Projects' })
    .click()
  await expect(page).toHaveURL(/\/projects$/)
  const link = page.getByRole('link', { name, exact: true })
  await expect(link).toBeVisible()

  // 4. Open the project detail.
  await link.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(name)
  const projectId = Number(new URL(page.url()).pathname.split('/').pop())

  // 5. Edit it.
  const edited = `${name} v2`
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editDialog = page.getByRole('dialog', { name: 'Edit project' })
  await expect(editDialog.getByLabel('Name')).toHaveValue(name)
  await editDialog.getByLabel('Name').fill(edited)
  await editDialog.getByLabel(/Deadline/).fill(day(30))
  await editDialog.getByRole('button', { name: 'Save changes' }).click()
  await expectToast(page, 'Project saved')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(edited)

  // 6. Reload and verify persistence (UI and database).
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(edited)
  const stored = await apiGet<{ name: string; due_date: string }>(
    page.request,
    `/api/projects/${projectId}`,
  )
  expect(stored.body).toMatchObject({ name: edited, due_date: day(30) })

  // 7. Delete it with confirmation.
  await page.getByRole('button', { name: `More actions for ${edited}` }).click()
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  const confirm = page.getByRole('alertdialog', { name: `Delete ${edited}?` })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Delete project' }).click()
  await expectToast(page, 'Project deleted')

  // 8. It is gone from the list and the database.
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByRole('link', { name: edited, exact: true })).toHaveCount(0)
  expect((await apiGet(page.request, `/api/projects/${projectId}`)).status).toBe(404)
})
