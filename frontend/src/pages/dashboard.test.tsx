import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeSummary, makeTask, page, day } from '@/test/fixtures'
import { deferred, mockApi } from '@/test/mock-api'
import { renderApp } from '@/test/render'

describe('Dashboard', () => {
  it('shows KPI values from the API and links each one to its filtered records', async () => {
    const summary = makeSummary({
      active_projects: 2,
      open_tasks: 12,
      completed_this_week: 5,
      overdue_tasks: 3,
    })
    mockApi({ 'GET /api/dashboard/summary': summary })
    renderApp('/')

    const open = await screen.findByRole('link', { name: /^Open tasks: 12\./ })
    expect(open).toHaveAttribute('href', '/tasks?status=open')
    expect(screen.getByRole('link', { name: /^Active projects: 2\./ })).toHaveAttribute(
      'href',
      '/projects?status=active',
    )
    expect(screen.getByRole('link', { name: /^Overdue tasks: 3\./ })).toHaveAttribute(
      'href',
      '/tasks?due=overdue',
    )
    expect(screen.getByRole('link', { name: /^Completed this week: 5\./ })).toHaveAttribute(
      'href',
      `/tasks?status=done&completed_from=${summary.week_start}&completed_to=${summary.week_end}`,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Ada$/)
    expect(screen.getByRole('link', { name: '3 tasks are overdue' })).toHaveAttribute(
      'href',
      '/tasks?due=overdue',
    )
  })

  it('shows a loading state until the summary arrives', async () => {
    const pending = deferred<{ body: unknown }>()
    mockApi({ 'GET /api/dashboard/summary': () => pending.promise })
    renderApp('/')

    const metrics = await screen.findByRole('region', { name: 'Key metrics' })
    expect(within(metrics).queryAllByRole('link')).toHaveLength(0)
    pending.resolve({ body: makeSummary({ open_tasks: 7 }) })
    expect(
      await within(metrics).findByRole('link', { name: /^Open tasks: 7\./ }),
    ).toBeInTheDocument()
  })

  it('shows an error with a working retry when the API fails', async () => {
    let fail = true
    mockApi({
      'GET /api/dashboard/summary': () =>
        fail
          ? {
              status: 500,
              body: { detail: 'Unexpected server error.', code: 'internal_error', errors: [] },
            }
          : { body: makeSummary({ open_tasks: 9 }) },
    })
    const { user } = renderApp('/')

    const metrics = await screen.findByRole('region', { name: 'Key metrics' })
    expect(await within(metrics).findByText('Unexpected server error.')).toBeInTheDocument()
    fail = false
    await user.click(within(metrics).getByRole('button', { name: 'Try again' }))
    expect(
      await within(metrics).findByRole('link', { name: /^Open tasks: 9\./ }),
    ).toBeInTheDocument()
  })

  it('invites the user to start when the workspace is empty', async () => {
    mockApi({
      'GET /api/dashboard/summary': makeSummary({
        active_projects: 0,
        total_projects: 0,
        total_tasks: 0,
        open_tasks: 0,
        overdue_tasks: 0,
        completed_this_week: 0,
        due_this_week: 0,
      }),
    })
    renderApp('/')
    expect(await screen.findByText(/Your workspace is empty/)).toBeInTheDocument()
    expect(await screen.findByText('No open tasks')).toBeInTheDocument()
    expect(screen.getByText('No activity yet')).toBeInTheDocument()
  })

  it('lists open tasks with deadlines in the My tasks panel', async () => {
    mockApi({
      'GET /api/tasks': page([
        makeTask({
          title: 'Ship the demo',
          due_date: day(-1),
          priority: 'urgent',
          status: 'in_progress',
        }),
      ]),
    })
    renderApp('/')
    const panel = await screen.findByRole('region', { name: 'My tasks' })
    expect(await within(panel).findByRole('button', { name: 'Ship the demo' })).toBeInTheDocument()
    expect(within(panel).getByText('1 day overdue')).toBeInTheDocument()
    await waitFor(() => expect(within(panel).getByText('Urgent')).toBeInTheDocument())
  })
})
