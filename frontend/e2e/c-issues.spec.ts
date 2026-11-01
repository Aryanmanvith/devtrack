import { expect, test } from '@playwright/test'
import { apiCreateProject, apiGet, chooseOption, expectToast, uid } from './helpers'

test('Journey C: report, prioritise, resolve, reopen and delete an issue', async ({ page }) => {
  const project = await apiCreateProject(page.request, { name: uid('Issues project') })
  const title = uid('Login button does nothing')

  // 1. Create an issue for a project.
  await page.goto('/issues')
  await page.getByRole('button', { name: 'Create issue' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Create issue' })
  await dialog.getByLabel('Title').fill(title)
  await dialog.getByLabel(/Description/).fill('Steps: open the login page and click the button.')
  await chooseOption(page, dialog.getByRole('combobox', { name: 'Project' }), project.name)
  await chooseOption(page, dialog.getByRole('combobox', { name: 'Type' }), 'Bug')
  await dialog.getByRole('button', { name: 'Create issue' }).click()
  await expectToast(page, 'Issue created')

  const issues = page.getByRole('list', { name: 'Issues' })
  const row = issues.getByRole('listitem').filter({ hasText: title })
  await expect(row).toBeVisible()

  // 2. Change its priority.
  await row.getByRole('button', { name: `Priority: Medium. Change priority of ${title}` }).click()
  await page.getByRole('menuitemradio', { name: 'High' }).click()
  await expectToast(page, 'Priority updated')
  const issueList = await apiGet<{ items: { id: number; title: string; priority: string }[] }>(
    page.request,
    `/api/issues?project_id=${project.id}`,
  )
  const stored = issueList.body.items.find((issue) => issue.title === title)
  expect(stored?.priority).toBe('high')
  const issueId = stored!.id

  // 3-4. Resolve it; the new state shows in the interface and the database.
  await row.getByRole('button', { name: title, exact: true }).click()
  const drawer = page.getByRole('dialog', { name: title })
  await drawer.getByRole('button', { name: 'Resolve' }).click()
  await expectToast(page, 'Issue resolved')
  await expect(drawer.getByRole('button', { name: 'Reopen' })).toBeVisible()
  await expect(drawer.getByRole('term').filter({ hasText: 'Resolved' })).toBeVisible()
  const resolved = await apiGet<{ status: string; resolved_at: string | null }>(
    page.request,
    `/api/issues/${issueId}`,
  )
  expect(resolved.body.status).toBe('resolved')
  expect(resolved.body.resolved_at).not.toBeNull()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await page.getByRole('tab', { name: /Resolved and closed/ }).click()
  await expect(row).toBeVisible()

  // 5. Reopen it, then delete it.
  await row.getByRole('button', { name: title, exact: true }).click()
  await drawer.getByRole('button', { name: 'Reopen' }).click()
  await expectToast(page, 'Issue reopened')
  expect(
    (
      await apiGet<{ status: string; resolved_at: string | null }>(
        page.request,
        `/api/issues/${issueId}`,
      )
    ).body,
  ).toMatchObject({
    status: 'open',
    resolved_at: null,
  })
  await drawer.getByRole('button', { name: 'Delete' }).click()
  await page
    .getByRole('alertdialog', { name: 'Delete this issue?' })
    .getByRole('button', { name: 'Delete issue' })
    .click()
  await expectToast(page, 'Issue deleted')
  expect((await apiGet(page.request, `/api/issues/${issueId}`)).status).toBe(404)

  // The activity log recorded each real change, and marks the issue as deleted.
  await page.goto(`/activity?type=issue&q=${encodeURIComponent(title)}`)
  const feed = page.getByRole('main')
  await expect(feed.getByText(`Deleted bug "${title}" from ${project.name}`)).toBeVisible()
  await expect(feed.getByText(`Reopened bug "${title}"`)).toBeVisible()
  await expect(feed.getByText(`Resolved bug "${title}"`)).toBeVisible()
  await expect(
    feed.getByText(`Changed priority of bug "${title}" from Medium to High`),
  ).toBeVisible()
  await expect(feed.getByText('Issue deleted').first()).toBeVisible()
})
