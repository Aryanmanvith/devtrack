/**
 * URL search parameters are the single source of truth for list filters, so filtered
 * views can be linked to (from KPI cards and charts), bookmarked and survive a reload.
 */
import type { QueryParams } from './api/client'
import type { IssueType, Priority, ProjectStatus, SortOrder, TaskStatus } from './api/types'
import {
  ISSUE_TYPE_ORDER,
  OPEN_TASK_STATUSES,
  PRIORITY_ORDER,
  PROJECT_STATUS_ORDER,
  TASK_STATUS_ORDER,
} from './meta'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | '' {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : ''
}

function positiveInt(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return parsed > 0 ? parsed : null
}

function isoDate(value: string | null): string {
  return value && ISO_DATE.test(value) ? value : ''
}

// ---- Tasks ---------------------------------------------------------------------------------

export type TaskStatusFilter = '' | 'open' | TaskStatus
export type DueFilter = '' | 'overdue' | 'today' | 'this_week' | 'upcoming' | 'no_date'
export type TaskSort = 'due_date' | 'priority' | 'created_at' | 'updated_at' | 'title'

export const DUE_FILTERS: { value: Exclude<DueFilter, ''>; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'this_week', label: 'Due this week' },
  { value: 'upcoming', label: 'Due today or later' },
  { value: 'no_date', label: 'No deadline' },
]

export const TASK_SORTS: { value: TaskSort; label: string; defaultOrder: SortOrder }[] = [
  { value: 'due_date', label: 'Deadline', defaultOrder: 'asc' },
  { value: 'priority', label: 'Priority', defaultOrder: 'desc' },
  { value: 'created_at', label: 'Date created', defaultOrder: 'desc' },
  { value: 'updated_at', label: 'Last updated', defaultOrder: 'desc' },
  { value: 'title', label: 'Title', defaultOrder: 'asc' },
]

export interface TaskFilters {
  q: string
  status: TaskStatusFilter
  priority: Priority | ''
  project: number | null
  due: DueFilter
  label: string
  completedFrom: string
  completedTo: string
  sort: TaskSort
  order: SortOrder
}

export function readTaskFilters(params: URLSearchParams): TaskFilters {
  const sort =
    oneOf(
      params.get('sort'),
      TASK_SORTS.map((s) => s.value),
    ) || 'due_date'
  const defaultOrder = TASK_SORTS.find((s) => s.value === sort)?.defaultOrder ?? 'asc'
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    status: oneOf(params.get('status'), ['open', ...TASK_STATUS_ORDER] as const),
    priority: oneOf(params.get('priority'), PRIORITY_ORDER),
    project: positiveInt(params.get('project')),
    due: oneOf(
      params.get('due'),
      DUE_FILTERS.map((d) => d.value),
    ),
    label: (params.get('label') ?? '').toLowerCase().slice(0, 24),
    completedFrom: isoDate(params.get('completed_from')),
    completedTo: isoDate(params.get('completed_to')),
    sort,
    order: oneOf(params.get('order'), ['asc', 'desc'] as const) || defaultOrder,
  }
}

export function taskQuery(filters: TaskFilters): QueryParams {
  return {
    q: filters.q.trim() || undefined,
    status: filters.status === 'open' ? OPEN_TASK_STATUSES : filters.status || undefined,
    priority: filters.priority || undefined,
    project_id: filters.project ?? undefined,
    due: filters.due || undefined,
    label: filters.label || undefined,
    completed_from: filters.completedFrom || undefined,
    completed_to: filters.completedTo || undefined,
    sort: filters.sort,
    order: filters.order,
    limit: 500,
  }
}

export const TASK_FILTER_KEYS = [
  'q',
  'status',
  'priority',
  'project',
  'due',
  'label',
  'completed_from',
  'completed_to',
] as const

// ---- Projects ------------------------------------------------------------------------------

export type ProjectSort = 'updated_at' | 'created_at' | 'name' | 'due_date' | 'progress'

export const PROJECT_SORTS: { value: ProjectSort; label: string }[] = [
  { value: 'updated_at', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'due_date', label: 'Deadline' },
  { value: 'progress', label: 'Progress' },
  { value: 'created_at', label: 'Date created' },
]

export interface ProjectFilters {
  q: string
  status: ProjectStatus | ''
  sort: ProjectSort
  view: 'grid' | 'list'
}

export function readProjectFilters(params: URLSearchParams): ProjectFilters {
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    status: oneOf(params.get('status'), PROJECT_STATUS_ORDER),
    sort:
      oneOf(
        params.get('sort'),
        PROJECT_SORTS.map((s) => s.value),
      ) || 'updated_at',
    view: params.get('view') === 'list' ? 'list' : 'grid',
  }
}

// ---- Issues --------------------------------------------------------------------------------

export type IssueState = 'open' | 'closed' | 'all'
export type IssueSort = 'created_at' | 'updated_at' | 'priority' | 'title'

export const ISSUE_SORTS: { value: IssueSort; label: string }[] = [
  { value: 'created_at', label: 'Newest' },
  { value: 'updated_at', label: 'Recently updated' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title' },
]

export interface IssueFilters {
  state: IssueState
  q: string
  type: IssueType | ''
  priority: Priority | ''
  project: number | null
  sort: IssueSort
}

export function readIssueFilters(params: URLSearchParams): IssueFilters {
  return {
    state: oneOf(params.get('state'), ['open', 'closed', 'all'] as const) || 'open',
    q: (params.get('q') ?? '').slice(0, 100),
    type: oneOf(params.get('type'), ISSUE_TYPE_ORDER),
    priority: oneOf(params.get('priority'), PRIORITY_ORDER),
    project: positiveInt(params.get('project')),
    sort:
      oneOf(
        params.get('sort'),
        ISSUE_SORTS.map((s) => s.value),
      ) || 'created_at',
  }
}

export { positiveInt }
