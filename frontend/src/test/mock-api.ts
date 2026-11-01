import { vi } from 'vitest'
import { defaultRoutes } from './fixtures'

export interface RecordedRequest {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
  headers: Record<string, string>
}

export interface MockResponse {
  status?: number
  body?: unknown
}

type Responder = (
  request: RecordedRequest,
  params: Record<string, string>,
) => MockResponse | Promise<MockResponse>

/** A JSON body (served with status 200) or a function that decides the response. */
export type RouteValue = Responder | object

/**
 * Replace window.fetch with a tiny router. Keys look like "PATCH /api/tasks/:id"; values
 * are either a JSON body (status 200) or a function returning { status, body }.
 * Every request is recorded so tests can assert exactly what the UI sent to the API.
 */
export function mockApi(routes: Record<string, RouteValue> = {}) {
  const calls: RecordedRequest[] = []
  const table = Object.entries({ ...defaultRoutes(), ...routes }).map(([key, handler]) => {
    const [method, pattern] = key.split(' ') as [string, string]
    const names = [...pattern.matchAll(/:([a-z_]+)/g)].map((match) => match[1] as string)
    const regex = new RegExp(`^${pattern.replace(/:[a-z_]+/g, '([^/]+)')}$`)
    return { method, regex, names, handler }
  })

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const method = init.method ?? 'GET'
    const request: RecordedRequest = {
      method,
      path: url.pathname,
      query: url.searchParams,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    }
    calls.push(request)
    for (const route of table) {
      if (route.method !== method) continue
      const match = url.pathname.match(route.regex)
      if (!match) continue
      const params = Object.fromEntries(
        route.names.map((name, index) => [name, match[index + 1] ?? '']),
      )
      const result =
        typeof route.handler === 'function'
          ? await (route.handler as Responder)(request, params)
          : { body: route.handler }
      const status = result.status ?? 200
      return new Response(status === 204 ? null : JSON.stringify(result.body ?? null), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(
      JSON.stringify({
        detail: `No mock for ${method} ${url.pathname}`,
        code: 'not_found',
        errors: [],
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  })

  vi.stubGlobal('fetch', fetchMock)

  return {
    calls,
    fetchMock,
    find: (method: string, path: string) =>
      calls.filter((call) => call.method === method && call.path === path),
  }
}

/** Respond with a specific HTTP status (for errors and 204 No Content). */
export function reply(status: number, body?: unknown) {
  return () => ({ status, body })
}

/** The backend's error format, for use with reply(). */
export function apiError(
  detail: string,
  code = 'internal_error',
  errors: { field: string; message: string }[] = [],
) {
  return { detail, code, errors }
}

/** A promise that the test resolves by hand, to observe loading states. */
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
