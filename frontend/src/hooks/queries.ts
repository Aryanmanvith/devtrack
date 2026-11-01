import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'

// Queries deliberately do not pass TanStack's AbortSignal to fetch: with React StrictMode
// that would cancel and repeat every request during development. Only search, where a
// newer keystroke makes the previous request useless, opts into cancellation.
import type { QueryParams } from '@/lib/api/client'
import { api } from '@/lib/api/endpoints'
import { qk } from '@/lib/query-keys'

export function usePreferences() {
  return useQuery({
    queryKey: qk.preferences,
    queryFn: () => api.preferences.get(),
    staleTime: 60_000,
  })
}

export function useHealth() {
  return useQuery({
    queryKey: qk.health,
    queryFn: () => api.health(),
    retry: false,
    refetchInterval: 60_000,
  })
}

export function useProjects(params: QueryParams, enabled = true) {
  return useQuery({
    queryKey: qk.projectList(params),
    queryFn: () => api.projects.list(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Non-archived projects for pickers and filters, sorted by name. */
export function useProjectOptions() {
  return useProjects({ sort: 'name', limit: 500 })
}

export function useProject(id: number | null) {
  return useQuery({
    queryKey: qk.project(id ?? 0),
    queryFn: () => api.projects.get(id as number),
    enabled: id !== null,
  })
}

export function useTasks(params: QueryParams, enabled = true) {
  return useQuery({
    queryKey: qk.taskList(params),
    queryFn: () => api.tasks.list(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useTask(id: number | null) {
  return useQuery({
    queryKey: qk.task(id ?? 0),
    queryFn: () => api.tasks.get(id as number),
    enabled: id !== null,
  })
}

export function useLabels() {
  return useQuery({ queryKey: qk.labels, queryFn: () => api.labels() })
}

export function useIssues(params: QueryParams) {
  return useQuery({
    queryKey: qk.issueList(params),
    queryFn: () => api.issues.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useIssueSummary(params: QueryParams) {
  return useQuery({
    queryKey: qk.issueSummary(params),
    queryFn: () => api.issues.summary(params),
  })
}

export function useIssue(id: number | null) {
  return useQuery({
    queryKey: qk.issue(id ?? 0),
    queryFn: () => api.issues.get(id as number),
    enabled: id !== null,
  })
}

export function useActivity(params: QueryParams, enabled = true) {
  return useQuery({
    queryKey: qk.activityList(params),
    queryFn: () => api.activity(params),
    enabled,
  })
}

export function useActivityFeed(params: QueryParams, pageSize = 25) {
  return useInfiniteQuery({
    queryKey: qk.activityList({ ...params, feed: true, pageSize }),
    queryFn: ({ pageParam }) => api.activity({ ...params, limit: pageSize, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
  })
}

export function useDashboardSummary() {
  return useQuery({ queryKey: qk.summary, queryFn: () => api.dashboard.summary() })
}

export function useCompletionTrend(weeks: number) {
  return useQuery({
    queryKey: qk.trend(weeks),
    queryFn: () => api.dashboard.trend(weeks),
    placeholderData: keepPreviousData,
  })
}

export function useTaskDistribution() {
  return useQuery({
    queryKey: qk.distribution,
    queryFn: () => api.dashboard.distribution(),
  })
}

export function useDeadlines(days: number, limit: number) {
  return useQuery({
    queryKey: qk.deadlines(days, limit),
    queryFn: () => api.dashboard.deadlines(days, limit),
  })
}

export function useAnalytics(params: QueryParams) {
  return useQuery({
    queryKey: qk.analytics(params),
    queryFn: () => api.analytics(params),
    placeholderData: keepPreviousData,
  })
}

export function useSearch(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: qk.search(term),
    queryFn: ({ signal }) => api.search(term, signal),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}

export function useDemoStatus() {
  return useQuery({ queryKey: qk.demo, queryFn: () => api.demo.status() })
}
