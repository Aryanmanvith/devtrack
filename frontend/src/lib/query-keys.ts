import type { QueryClient } from '@tanstack/react-query'
import type { QueryParams } from './api/client'

export const qk = {
  health: ['health'] as const,
  preferences: ['preferences'] as const,
  projects: ['projects'] as const,
  projectList: (params: QueryParams) => ['projects', 'list', params] as const,
  project: (id: number) => ['projects', 'detail', id] as const,
  tasks: ['tasks'] as const,
  taskList: (params: QueryParams) => ['tasks', 'list', params] as const,
  task: (id: number) => ['tasks', 'detail', id] as const,
  labels: ['labels'] as const,
  issues: ['issues'] as const,
  issueList: (params: QueryParams) => ['issues', 'list', params] as const,
  issueSummary: (params: QueryParams) => ['issues', 'summary', params] as const,
  issue: (id: number) => ['issues', 'detail', id] as const,
  activity: ['activity'] as const,
  activityList: (params: QueryParams) => ['activity', 'list', params] as const,
  dashboard: ['dashboard'] as const,
  summary: ['dashboard', 'summary'] as const,
  trend: (weeks: number) => ['dashboard', 'trend', weeks] as const,
  distribution: ['dashboard', 'distribution'] as const,
  deadlines: (days: number, limit: number) => ['dashboard', 'deadlines', days, limit] as const,
  analytics: (params: QueryParams) => ['analytics', params] as const,
  search: (q: string) => ['search', q] as const,
  demo: ['demo'] as const,
}

const WORKSPACE_ROOTS = [
  'projects',
  'tasks',
  'labels',
  'issues',
  'activity',
  'dashboard',
  'analytics',
  'search',
  'demo',
]

/**
 * After any successful (or failed) write, mark every workspace query stale so dashboard
 * metrics, charts, lists, counts and the activity feed are refetched from the server.
 * Only queries currently on screen refetch immediately; the rest refetch when shown.
 */
export function invalidateWorkspace(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => WORKSPACE_ROOTS.includes(String(query.queryKey[0])),
  })
}
