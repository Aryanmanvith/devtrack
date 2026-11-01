import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Issue, Task } from '@/lib/api/types'
import { makeIssue, makeTask, page } from '@/test/fixtures'
import { apiError, mockApi, reply } from '@/test/mock-api'
import { renderApp } from '@/test/render'

describe('Issues', () => {
  it('resolves an issue from its detail drawer', async () => {
    const issue = makeIssue({ title: 'Login fails on Safari' })
    const api = mockApi({
      'GET /api/issues': page([issue]),
      'GET /api/issues/:id': issue,
      'PATCH /api/issues/:id': (request) => ({
        body: {
          ...issue,
          ...(request.body as Partial<Issue>),
          resolved_at: new Date().toISOString(),
        },
      }),
    })
    const { user } = renderApp('/issues')
    await user.click(await screen.findByRole('button', { name: 'Login fails on Safari' }))
    const drawer = await screen.findByRole('dialog', { name: 'Login fails on Safari' })
    await user.click(within(drawer).getByRole('button', { name: 'Resolve' }))

    await waitFor(() =>
      expect(api.find('PATCH', `/api/issues/${issue.id}`)[0]?.body).toEqual({ status: 'resolved' }),
    )
    expect(await screen.findByText('Issue resolved')).toBeInTheDocument()
  })

  it('changes priority inline', async () => {
    const issue = makeIssue({ title: 'Slow page', priority: 'medium' })
    const api = mockApi({
      'GET /api/issues': page([issue]),
      'PATCH /api/issues/:id': (request) => ({
        body: { ...issue, ...(request.body as Partial<Issue>) },
      }),
    })
    const { user } = renderApp('/issues')
    await user.click(
      await screen.findByRole('button', { name: 'Priority: Medium. Change priority of Slow page' }),
    )
    await user.click(await screen.findByRole('menuitemradio', { name: 'High' }))
    await waitFor(() =>
      expect(api.find('PATCH', `/api/issues/${issue.id}`)[0]?.body).toEqual({ priority: 'high' }),
    )
    expect(await screen.findByText('Priority updated')).toBeInTheDocument()
  })

  it('shows a helpful empty state for open issues', async () => {
    mockApi()
    renderApp('/issues')
    expect(await screen.findByText('No open issues')).toBeInTheDocument()
  })
})

describe('Kanban board', () => {
  it('moves a card to another column with the accessible status menu', async () => {
    let task = makeTask({ title: 'Draft slides', status: 'todo' })
    const api = mockApi({
      'GET /api/tasks': () => ({ body: page([task]) }),
      'PATCH /api/tasks/:id': (request) => {
        task = { ...task, ...(request.body as Partial<Task>) }
        return { body: task }
      },
    })
    const { user } = renderApp('/board')
    const todo = await screen.findByTestId('kanban-column-todo')
    expect(await within(todo).findByRole('button', { name: 'Draft slides' })).toBeInTheDocument()

    await user.click(
      within(todo).getByRole('button', { name: 'Status: To Do. Change status of Draft slides' }),
    )
    await user.click(await screen.findByRole('menuitemradio', { name: 'In Review' }))

    await waitFor(() =>
      expect(api.find('PATCH', `/api/tasks/${task.id}`)[0]?.body).toEqual({ status: 'in_review' }),
    )
    const review = screen.getByTestId('kanban-column-in_review')
    expect(await within(review).findByRole('button', { name: 'Draft slides' })).toBeInTheDocument()
    expect(
      within(screen.getByTestId('kanban-column-todo')).queryByRole('button', {
        name: 'Draft slides',
      }),
    ).toBeNull()
  })

  it('returns the card to its column when the move fails', async () => {
    const task = makeTask({ title: 'Draft slides', status: 'todo' })
    mockApi({
      'GET /api/tasks': page([task]),
      'PATCH /api/tasks/:id': reply(
        503,
        apiError('The database is unavailable.', 'database_error'),
      ),
    })
    const { user } = renderApp('/board')
    const todo = await screen.findByTestId('kanban-column-todo')
    await user.click(
      await within(todo).findByRole('button', {
        name: 'Status: To Do. Change status of Draft slides',
      }),
    )
    await user.click(await screen.findByRole('menuitemradio', { name: 'Done' }))

    expect(await screen.findByText('Could not change the status')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(screen.getByTestId('kanban-column-todo')).getByRole('button', {
          name: 'Draft slides',
        }),
      ).toBeInTheDocument(),
    )
    expect(
      within(screen.getByTestId('kanban-column-done')).queryByRole('button', {
        name: 'Draft slides',
      }),
    ).toBeNull()
  })
})
