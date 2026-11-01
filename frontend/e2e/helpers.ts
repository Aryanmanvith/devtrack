import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'

export const TZ = { 'X-Timezone': 'UTC' }

export function uid(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
}

/** A calendar date relative to today in UTC (the browser runs in UTC too). */
export function day(offset: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

// Records are created through the same HTTP API the UI uses; assertions then check that
// the interface shows exactly what the database returns.

export async function apiCreateProject(
  request: APIRequestContext,
  data: Record<string, unknown> = {},
) {
  const response = await request.post('/api/projects', {
    headers: TZ,
    data: { name: uid('Project'), status: 'active', ...data },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()) as { id: number; name: string }
}

export async function apiCreateTask(request: APIRequestContext, data: Record<string, unknown>) {
  const response = await request.post('/api/tasks', { headers: TZ, data })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()) as { id: number; title: string; status: string }
}

export async function apiCreateIssue(request: APIRequestContext, data: Record<string, unknown>) {
  const response = await request.post('/api/issues', { headers: TZ, data })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()) as { id: number; title: string }
}

export async function apiGet<T = Record<string, unknown>>(
  request: APIRequestContext,
  path: string,
) {
  const response = await request.get(path, { headers: TZ })
  return { status: response.status(), body: (response.ok() ? await response.json() : null) as T }
}

export async function chooseOption(page: Page, combobox: Locator, option: string | RegExp) {
  await combobox.click()
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click()
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: text }).first()).toBeVisible()
}

/** Read the number shown on a dashboard KPI link, e.g. "Open tasks: 12. View open tasks". */
export async function kpiValue(page: Page, label: string) {
  const link = page.getByRole('link', { name: new RegExp(`^${label}: \\d+\\.`) })
  await expect(link).toBeVisible()
  const name = (await link.getAttribute('aria-label')) ?? ''
  return Number(name.match(/: (\d+)\./)?.[1])
}
