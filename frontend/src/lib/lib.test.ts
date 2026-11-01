import { describe, expect, it, vi } from 'vitest'
import { apiError, mockApi, reply } from '@/test/mock-api'
import { ApiError, buildUrl, request } from './api/client'
import { describeDue, rangeLabel } from './dates'
import { readTaskFilters, taskQuery } from './filters'
import { isDateBefore, parseLabels } from './form-utils'
import { positionBetween } from './kanban'
import { day } from '@/test/fixtures'

describe('api client', () => {
  it('builds query strings with repeated keys and skips empty values', () => {
    const url = new URL(
      buildUrl('/api/tasks', { status: ['todo', 'done'], q: '', project_id: 3, due: undefined }),
    )
    expect(url.pathname).toBe('/api/tasks')
    expect(url.searchParams.getAll('status')).toEqual(['todo', 'done'])
    expect(url.searchParams.get('project_id')).toBe('3')
    expect(url.searchParams.has('q')).toBe(false)
    expect(url.searchParams.has('due')).toBe(false)
  })

  it('sends the viewer time zone and parses JSON', async () => {
    const api = mockApi({ 'GET /api/health': { status: 'ok' } })
    await expect(request('GET', '/api/health')).resolves.toEqual({ status: 'ok' })
    expect(api.calls[0]?.headers['X-Timezone']).toBeTruthy()
  })

  it('turns error responses into ApiError with field messages', async () => {
    mockApi({
      'POST /api/projects': reply(
        409,
        apiError('A project named "X" already exists.', 'conflict', [
          { field: 'name', message: 'A project named "X" already exists.' },
        ]),
      ),
    })
    const error = (await request('POST', '/api/projects', { body: { name: 'X' } }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.code).toBe('conflict')
    expect(error.message).toBe('A project named "X" already exists.')
    expect(error.fieldErrors).toEqual({ name: 'A project named "X" already exists.' })
  })

  it('explains network failures in plain language', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = (await request('GET', '/api/health').catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('network_error')
    expect(error.message).toMatch(/backend is running/)
  })

  it('returns undefined for 204 responses', async () => {
    mockApi({ 'DELETE /api/tasks/:id': reply(204) })
    await expect(request('DELETE', '/api/tasks/4')).resolves.toBeUndefined()
  })
})

describe('task filters from the URL', () => {
  it('expands "open" to every status except done and keeps valid values only', () => {
    const filters = readTaskFilters(
      new URLSearchParams('status=open&priority=urgent&due=overdue&project=7&sort=bogus&label=API'),
    )
    expect(filters).toMatchObject({
      status: 'open',
      priority: 'urgent',
      due: 'overdue',
      project: 7,
      sort: 'due_date',
      label: 'api',
    })
    const query = taskQuery(filters)
    expect(query.status).toEqual(['backlog', 'todo', 'in_progress', 'in_review'])
    expect(query.project_id).toBe(7)
  })

  it('ignores invalid dates and unknown statuses', () => {
    const filters = readTaskFilters(new URLSearchParams('status=finished&completed_from=yesterday'))
    expect(filters.status).toBe('')
    expect(filters.completedFrom).toBe('')
  })
})

describe('form helpers', () => {
  it('normalises labels', () => {
    expect(parseLabels(' Front End, testing,TESTING ,, ')).toEqual(['front-end', 'testing'])
  })

  it('compares calendar dates as dates', () => {
    expect(isDateBefore('2026-04-09', '2026-04-10')).toBe(true)
    expect(isDateBefore('2026-04-10', '2026-04-10')).toBe(false)
  })
})

describe('kanban positions', () => {
  it('places a card between, before or after its neighbours', () => {
    expect(positionBetween(1024, 2048)).toBe(1536)
    expect(positionBetween(undefined, 1024)).toBe(0)
    expect(positionBetween(4096, undefined)).toBe(5120)
    expect(positionBetween()).toBe(1024)
  })
})

describe('deadline wording', () => {
  it('describes deadlines relative to today', () => {
    expect(describeDue(day(-2), false)).toEqual({ label: '2 days overdue', tone: 'overdue' })
    expect(describeDue(day(0), false)?.label).toBe('Due today')
    expect(describeDue(day(1), false)?.label).toBe('Due tomorrow')
    expect(describeDue(day(-5), true)?.tone).toBe('done')
    expect(describeDue(null, false)).toBeNull()
  })

  it('formats week ranges compactly', () => {
    expect(rangeLabel('2026-10-26', '2026-11-01')).toBe('Oct 26 – Nov 1')
    expect(rangeLabel('2026-11-02', '2026-11-08')).toBe('Nov 2 – 8')
  })
})
