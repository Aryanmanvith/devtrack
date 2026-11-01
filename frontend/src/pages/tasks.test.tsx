import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Task } from '@/lib/api/types'
import { makeTask, page } from '@/test/fixtures'
import { apiError, mockApi, reply } from '@/test/mock-api'
import { currentSearch, renderApp } from '@/test/render'

function lastTaskQuery(api: ReturnType<typeof mockApi>) {
  return api.find('GET', '/api/tasks').at(-1)?.query
}

describe('My Tasks', () => {
  it('searches on the server and reflects the search in the URL', async () => {
    const tasks = [makeTask({ title: 'Fix login bug' }), makeTask({ title: 'Write report' })]
    const api = mockApi({
      'GET /api/tasks': (request) => {
        const q = request.query.get('q')?.toLowerCase()
        return { body: page(tasks.filter((t) => !q || t.title.toLowerCase().includes(q))) }
      },
    })
    const { user, router } = renderApp('/tasks')
    expect(await screen.findByRole('button', { name: 'Write report' })).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'login')
    await waitFor(() => expect(lastTaskQuery(api)?.get('q')).toBe('login'))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Write report' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Fix login bug' })).toBeInTheDocument()
    expect(currentSearch(router).get('q')).toBe('login')
  })

  it('applies filters from the URL, shows them and clears them', async () => {
    const api = mockApi({ 'GET /api/tasks': page([makeTask({ title: 'Late task' })]) })
    const { user, router } = renderApp('/tasks?status=open&due=overdue')

    const chips = await screen.findByRole('group', { name: 'Results and active filters' })
    expect(within(chips).getByText('Open')).toBeInTheDocument()
    expect(within(chips).getByText('Overdue')).toBeInTheDocument()
    await waitFor(() => {
      const query = lastTaskQuery(api)
      expect(query?.getAll('status')).toEqual(['backlog', 'todo', 'in_progress', 'in_review'])
      expect(query?.get('due')).toBe('overdue')
    })

    await user.click(within(chips).getByRole('button', { name: 'Clear all' }))
    await waitFor(() => expect(currentSearch(router).toString()).toBe(''))
    await waitFor(() => {
      const query = lastTaskQuery(api)
      expect(query?.getAll('status')).toEqual([])
      expect(query?.get('due')).toBeNull()
    })
  })

  it('keeps a filter removed while a search is still waiting to apply', async () => {
    mockApi({ 'GET /api/tasks': page([makeTask({ title: 'Fix login bug' })]) })
    const { user, router } = renderApp('/tasks?priority=high&due=overdue')
    const chips = await screen.findByRole('group', { name: 'Results and active filters' })

    // Typing starts the 300 ms search debounce; the chip is removed before it fires.
    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'login')
    await user.click(within(chips).getByRole('button', { name: 'Remove filter Priority: High' }))

    await waitFor(() => expect(currentSearch(router).get('q')).toBe('login'))
    expect(currentSearch(router).get('priority')).toBeNull()
    expect(currentSearch(router).get('due')).toBe('overdue')
  })

  it('shows a search changed from outside the field, even while it has focus', async () => {
    mockApi({ 'GET /api/tasks': page([makeTask()]) })
    const { user, router } = renderApp('/tasks')
    const search = await screen.findByRole('searchbox', { name: 'Search tasks' })
    await user.type(search, 'login')
    await waitFor(() => expect(currentSearch(router).get('q')).toBe('login'))
    expect(search).toHaveFocus()

    await act(() => router.navigate('/tasks?q=report'))
    await waitFor(() => expect(search).toHaveValue('report'))
    await act(() => router.navigate('/tasks'))
    await waitFor(() => expect(search).toHaveValue(''))
  })

  it('changes sorting through the sort control', async () => {
    const api = mockApi({ 'GET /api/tasks': page([makeTask()]) })
    const { user, router } = renderApp('/tasks')
    await screen.findByRole('list', { name: 'Tasks' })
    await user.click(screen.getByRole('button', { name: /^Sort ascending/ }))
    await waitFor(() => expect(currentSearch(router).get('order')).toBe('desc'))
    await waitFor(() => expect(lastTaskQuery(api)?.get('order')).toBe('desc'))
  })

  it('updates a task status and confirms after the server responds', async () => {
    const task = makeTask({ title: 'Write docs', status: 'todo' })
    const api = mockApi({
      'GET /api/tasks': page([task]),
      'PATCH /api/tasks/:id': (request) => ({
        body: { ...task, ...(request.body as Partial<Task>) },
      }),
    })
    const { user } = renderApp('/tasks')
    await user.click(
      await screen.findByRole('button', { name: 'Status: To Do. Change status of Write docs' }),
    )
    await user.click(await screen.findByRole('menuitemradio', { name: 'In Progress' }))

    await waitFor(() => expect(api.find('PATCH', `/api/tasks/${task.id}`)).toHaveLength(1))
    expect(api.find('PATCH', `/api/tasks/${task.id}`)[0]?.body).toEqual({ status: 'in_progress' })
    expect(await screen.findByText('Moved to In Progress')).toBeInTheDocument()
  })

  it('rolls back a status change the server rejects and says so', async () => {
    const task = makeTask({ title: 'Write docs', status: 'todo' })
    mockApi({
      'GET /api/tasks': page([task]),
      'PATCH /api/tasks/:id': reply(500, apiError('Unexpected server error.')),
    })
    const { user } = renderApp('/tasks')
    await user.click(
      await screen.findByRole('button', { name: 'Status: To Do. Change status of Write docs' }),
    )
    await user.click(await screen.findByRole('menuitemradio', { name: 'Done' }))

    expect(await screen.findByText('Could not change the status')).toBeInTheDocument()
    expect(screen.getByText(/The change was undone/)).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Status: To Do. Change status of Write docs' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Task completed')).not.toBeInTheDocument()
  })

  it('completes a task with the checkbox', async () => {
    const task = makeTask({ title: 'Book room' })
    const api = mockApi({
      'GET /api/tasks': page([task]),
      'PATCH /api/tasks/:id': (request) => ({
        body: { ...task, ...(request.body as Partial<Task>) },
      }),
    })
    const { user } = renderApp('/tasks')
    await user.click(await screen.findByRole('checkbox', { name: 'Mark "Book room" as done' }))
    await waitFor(() =>
      expect(api.find('PATCH', `/api/tasks/${task.id}`)[0]?.body).toEqual({ status: 'done' }),
    )
    expect(await screen.findByText('Task completed')).toBeInTheDocument()
  })

  it('distinguishes "no tasks yet" from "no matches"', async () => {
    mockApi({ 'GET /api/tasks': page([]) })
    const { user, router } = renderApp('/tasks?priority=urgent')
    expect(await screen.findByText('No tasks match these filters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument()
    expect(currentSearch(router).get('priority')).toBeNull()
  })
})
