// Types mirror the FastAPI response schemas in backend/app/schemas.

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived'
export type ProjectColor =
  'indigo' | 'violet' | 'sky' | 'teal' | 'emerald' | 'amber' | 'rose' | 'slate'
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type IssueType = 'bug' | 'feature' | 'improvement' | 'question'
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type Theme = 'dark' | 'light' | 'system'
export type WeekStart = 'monday' | 'sunday'
export type EntityType = 'project' | 'task' | 'issue' | 'system'
export type SortOrder = 'asc' | 'desc'

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface ProjectBrief {
  id: number
  name: string
  color: ProjectColor
  status: ProjectStatus
  is_demo: boolean
}

export interface Project extends ProjectBrief {
  description: string
  owner: string | null
  start_date: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  task_count: number
  completed_task_count: number
  open_task_count: number
  overdue_task_count: number
  open_issue_count: number
  progress: number
}

export interface ProjectInput {
  name: string
  description: string
  status: ProjectStatus
  color: ProjectColor
  owner: string | null
  start_date: string | null
  due_date: string | null
}

export interface Task {
  id: number
  project_id: number
  project: ProjectBrief
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  due_date: string | null
  position: number
  labels: string[]
  is_demo: boolean
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TaskInput {
  title: string
  description: string
  project_id: number
  status: TaskStatus
  priority: Priority
  due_date: string | null
  labels: string[]
}

export type TaskPatch = Partial<TaskInput> & { position?: number }

export interface Issue {
  id: number
  project_id: number
  project: ProjectBrief
  title: string
  description: string
  type: IssueType
  priority: Priority
  status: IssueStatus
  is_demo: boolean
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface IssueInput {
  title: string
  description: string
  project_id: number
  type: IssueType
  priority: Priority
  status: IssueStatus
}

export interface CountItem {
  key: string
  count: number
}

export interface IssueSummary {
  total: number
  open: number
  closed: number
  by_status: CountItem[]
  by_type: CountItem[]
}

export interface Activity {
  id: number
  event_type: string
  entity_type: EntityType
  entity_id: number | null
  project_id: number | null
  project: ProjectBrief | null
  description: string
  details: Record<string, unknown> | null
  created_at: string
  entity_exists: boolean | null
}

export interface DashboardSummary {
  today: string
  week_start: string
  week_end: string
  timezone: string
  active_projects: number
  open_projects: number
  total_projects: number
  total_tasks: number
  open_tasks: number
  in_progress_tasks: number
  completed_this_week: number
  completed_last_week: number
  overdue_tasks: number
  due_today: number
  due_this_week: number
  open_issues: number
}

export interface TrendPoint {
  week_start: string
  week_end: string
  completed: number
  created: number
  remaining: number
}

export interface CompletionTrend {
  weeks: number
  today: string
  points: TrendPoint[]
}

export interface TaskDistribution {
  total: number
  open_total: number
  by_status: CountItem[]
  by_priority: CountItem[]
}

export interface DeadlineItem extends Task {
  days_until: number
  is_overdue: boolean
}

export interface UpcomingDeadlines {
  today: string
  days: number
  overdue_count: number
  upcoming_count: number
  items: DeadlineItem[]
}

export interface ProjectProgressItem {
  project: ProjectBrief
  total: number
  done: number
  open: number
  progress: number
}

export interface AnalyticsOverview {
  today: string
  weeks: number
  range_start: string
  range_end: string
  project_id: number | null
  total_tasks: number
  completed_tasks: number
  open_tasks: number
  overdue_tasks: number
  completion_rate: number
  completed_in_range: number
  created_in_range: number
  avg_cycle_days: number | null
  open_issues: number
  resolved_issues_in_range: number
  by_status: CountItem[]
  by_priority: CountItem[]
  weekly: TrendPoint[]
  daily_completions: { date: string; count: number }[]
  project_progress: ProjectProgressItem[]
  issues_by_type: { type: IssueType; open: number; closed: number }[]
}

export interface SearchResults {
  query: string
  projects: ProjectBrief[]
  tasks: {
    id: number
    title: string
    status: TaskStatus
    priority: Priority
    project: ProjectBrief
  }[]
  issues: {
    id: number
    title: string
    status: IssueStatus
    type: IssueType
    project: ProjectBrief
  }[]
}

export interface Preferences {
  display_name: string
  theme: Theme
  week_start: WeekStart
  updated_at: string
}

export interface Label {
  name: string
  count: number
}

export interface DemoStatus {
  has_demo_data: boolean
  projects: number
  tasks: number
  issues: number
  user_tasks_in_demo_projects: number
  user_issues_in_demo_projects: number
}

export interface DemoRemoval {
  removed_projects: number
  removed_tasks: number
  removed_issues: number
}

export interface Health {
  status: 'ok' | 'degraded'
  database: 'ok' | 'unavailable'
  version: string
  time: string
}
