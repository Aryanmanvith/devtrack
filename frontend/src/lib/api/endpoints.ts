import { request, type QueryParams } from './client'
import type {
  Activity,
  AnalyticsOverview,
  CompletionTrend,
  DashboardSummary,
  DemoRemoval,
  DemoStatus,
  Health,
  Issue,
  IssueInput,
  IssueSummary,
  Label,
  Page,
  Preferences,
  Project,
  ProjectInput,
  SearchResults,
  Task,
  TaskDistribution,
  TaskInput,
  TaskPatch,
  UpcomingDeadlines,
} from './types'

const get = <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
  request<T>('GET', path, { query, signal })

export const api = {
  health: (signal?: AbortSignal) => get<Health>('/api/health', undefined, signal),

  projects: {
    list: (query: QueryParams, signal?: AbortSignal) =>
      get<Page<Project>>('/api/projects', query, signal),
    get: (id: number, signal?: AbortSignal) =>
      get<Project>(`/api/projects/${id}`, undefined, signal),
    create: (body: ProjectInput) => request<Project>('POST', '/api/projects', { body }),
    update: (id: number, body: Partial<ProjectInput>) =>
      request<Project>('PATCH', `/api/projects/${id}`, { body }),
    remove: (id: number) => request<void>('DELETE', `/api/projects/${id}`),
  },

  tasks: {
    list: (query: QueryParams, signal?: AbortSignal) =>
      get<Page<Task>>('/api/tasks', query, signal),
    get: (id: number, signal?: AbortSignal) => get<Task>(`/api/tasks/${id}`, undefined, signal),
    create: (body: TaskInput) => request<Task>('POST', '/api/tasks', { body }),
    update: (id: number, body: TaskPatch) => request<Task>('PATCH', `/api/tasks/${id}`, { body }),
    remove: (id: number) => request<void>('DELETE', `/api/tasks/${id}`),
  },

  labels: (signal?: AbortSignal) => get<Label[]>('/api/labels', undefined, signal),

  issues: {
    list: (query: QueryParams, signal?: AbortSignal) =>
      get<Page<Issue>>('/api/issues', query, signal),
    summary: (query: QueryParams, signal?: AbortSignal) =>
      get<IssueSummary>('/api/issues/summary', query, signal),
    get: (id: number, signal?: AbortSignal) => get<Issue>(`/api/issues/${id}`, undefined, signal),
    create: (body: IssueInput) => request<Issue>('POST', '/api/issues', { body }),
    update: (id: number, body: Partial<IssueInput>) =>
      request<Issue>('PATCH', `/api/issues/${id}`, { body }),
    remove: (id: number) => request<void>('DELETE', `/api/issues/${id}`),
  },

  activity: (query: QueryParams, signal?: AbortSignal) =>
    get<Page<Activity>>('/api/activity', query, signal),

  dashboard: {
    summary: (signal?: AbortSignal) =>
      get<DashboardSummary>('/api/dashboard/summary', undefined, signal),
    trend: (weeks: number, signal?: AbortSignal) =>
      get<CompletionTrend>('/api/dashboard/completion-trend', { weeks }, signal),
    distribution: (signal?: AbortSignal) =>
      get<TaskDistribution>('/api/dashboard/task-distribution', undefined, signal),
    deadlines: (days: number, limit: number, signal?: AbortSignal) =>
      get<UpcomingDeadlines>('/api/dashboard/upcoming-deadlines', { days, limit }, signal),
  },

  analytics: (query: QueryParams, signal?: AbortSignal) =>
    get<AnalyticsOverview>('/api/analytics/overview', query, signal),

  search: (q: string, signal?: AbortSignal) => get<SearchResults>('/api/search', { q }, signal),

  preferences: {
    get: (signal?: AbortSignal) => get<Preferences>('/api/preferences', undefined, signal),
    update: (body: Partial<Pick<Preferences, 'display_name' | 'theme' | 'week_start'>>) =>
      request<Preferences>('PATCH', '/api/preferences', { body }),
  },

  demo: {
    status: (signal?: AbortSignal) => get<DemoStatus>('/api/demo-data', undefined, signal),
    load: () => request<DemoStatus>('POST', '/api/demo-data'),
    remove: () => request<DemoRemoval>('DELETE', '/api/demo-data'),
  },
}
