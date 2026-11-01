/**
 * Thin fetch wrapper. Every request goes to the FastAPI backend over HTTP; there is no
 * client-side fake data. Errors are normalised into ApiError using the backend's
 * {detail, code, errors[]} format so forms can highlight fields and toasts can explain.
 */

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[]
export type QueryParams = Record<string, QueryValue>

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }

  get isNotFound() {
    return this.status === 404
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export const viewerTimeZone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
})()

export function buildUrl(path: string, query?: QueryParams) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item))
    } else {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

interface ErrorBody {
  detail?: unknown
  code?: unknown
  errors?: { field?: string | null; message?: string }[]
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ErrorBody | null
  try {
    body = (await response.json()) as ErrorBody
  } catch {
    body = null
  }
  const fieldErrors: Record<string, string> = {}
  for (const error of body?.errors ?? []) {
    if (error.field && error.message && !fieldErrors[error.field]) {
      fieldErrors[error.field] = error.message
    }
  }
  const detail =
    typeof body?.detail === 'string'
      ? body.detail
      : response.status >= 500
        ? 'The server hit an error. Check the backend terminal for details.'
        : `Request failed with status ${response.status}.`
  const code = typeof body?.code === 'string' ? body.code : `http_${response.status}`
  return new ApiError(response.status, code, detail, fieldErrors)
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: { query?: QueryParams; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Timezone': viewerTimeZone,
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      0,
      'network_error',
      'Cannot reach the DevTrack API. Make sure the backend is running on port 8000.',
    )
  }

  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.') {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
