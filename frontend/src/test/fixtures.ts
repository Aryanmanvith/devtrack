import { addDays, format } from 'date-fns'
import type {
  DashboardSummary,
  Issue,
  Page,
  Preferences,
  Project,
  ProjectBrief,
  Task,
} from '@/lib/api/types'

const NOW = new Date().toISOString()

/** A calendar date relative to today, in the browser's local time zone. */
export function day(offset: number) {
  return format(addDays(new Date(), offset), 'yyyy-MM-dd')
}

export function page<T>(items: T[], total = items.length): Page<T> {
  return { items, total, limit: 500, offset: 0 }
}

export function brief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    id: 1,
    name: 'Capstone Tracker',
    color: 'indigo',
    status: 'active',
    is_demo: false,
    ...overrides,
  }
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    ...brief(),
    description: 'Final year project',
    owner: 'Ada',
    start_date: null,
    due_date: null,
    created_at: NOW,
    updated_at: NOW,
    task_count: 4,
    completed_task_count: 1,
    open_task_count: 3,
    overdue_task_count: 0,
    open_issue_count: 0,
    progress: 25,
    ...overrides,
  }
}

let nextId = 100

export function makeTask(overrides: Partial<Task> = {}): Task {
  nextId += 1
  return {
    id: nextId,
    project_id: 1,
    project: brief(),
    title: `Task ${nextId}`,
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: null,
    position: nextId * 1024,
    labels: [],
    is_demo: false,
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    ...overrides,
  }
}

export function makeIssue(overrides: Partial<Issue> = {}): Issue {
  nextId += 1
  return {
    id: nextId,
    project_id: 1,
    project: brief(),
    title: `Issue ${nextId}`,
    description: '',
    type: 'bug',
    priority: 'medium',
    status: 'open',
    is_demo: false,
    created_at: NOW,
    updated_at: NOW,
    resolved_at: null,
    ...overrides,
  }
}

export function makeSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    today: day(0),
    week_start: day(-2),
    week_end: day(4),
    timezone: 'UTC',
    active_projects: 2,
    open_projects: 3,
    total_projects: 4,
    total_tasks: 20,
    open_tasks: 12,
    in_progress_tasks: 3,
    completed_this_week: 5,
    completed_last_week: 2,
    overdue_tasks: 3,
    due_today: 1,
    due_this_week: 4,
    open_issues: 6,
    ...overrides,
  }
}

export const preferences: Preferences = {
  display_name: 'Ada',
  theme: 'dark',
  week_start: 'monday',
  updated_at: NOW,
}

/** Responses for the requests every page makes (sidebar counts, alerts, pickers). */
export function defaultRoutes() {
  return {
    'GET /api/preferences': preferences,
    'GET /api/health': { status: 'ok', database: 'ok', version: '1.0.0', time: NOW },
    'GET /api/dashboard/summary': makeSummary(),
    'GET /api/dashboard/upcoming-deadlines': {
      today: day(0),
      days: 14,
      overdue_count: 0,
      upcoming_count: 0,
      items: [],
    },
    'GET /api/dashboard/completion-trend': { weeks: 8, today: day(0), points: [] },
    'GET /api/dashboard/task-distribution': {
      total: 0,
      open_total: 0,
      by_status: [],
      by_priority: [],
    },
    'GET /api/projects': page<Project>([]),
    'GET /api/tasks': page<Task>([]),
    'GET /api/issues': page<Issue>([]),
    'GET /api/issues/summary': { total: 0, open: 0, closed: 0, by_status: [], by_type: [] },
    'GET /api/activity': page([]),
    'GET /api/labels': [],
    'GET /api/demo-data': {
      has_demo_data: false,
      projects: 0,
      tasks: 0,
      issues: 0,
      user_tasks_in_demo_projects: 0,
      user_issues_in_demo_projects: 0,
    },
  } satisfies Record<string, unknown>
}
