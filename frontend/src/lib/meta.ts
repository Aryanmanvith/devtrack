import {
  Bug,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleDotDashed,
  CircleSlash,
  Lightbulb,
  MessageCircleQuestionMark,
  ScanEye,
  SignalHigh,
  SignalLow,
  SignalMedium,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type {
  IssueStatus,
  IssueType,
  Priority,
  ProjectColor,
  ProjectStatus,
  TaskStatus,
} from './api/types'

interface Meta {
  label: string
  icon: LucideIcon
  /** Tailwind text color class (kept as literals so Tailwind can see them). */
  text: string
  /** Tailwind background class for dots and swatches. */
  dot: string
  /** CSS color used by charts. */
  color: string
}

export const TASK_STATUS_ORDER: TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
]
export const OPEN_TASK_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review']

export const TASK_STATUS: Record<TaskStatus, Meta> = {
  backlog: {
    label: 'Backlog',
    icon: CircleDashed,
    text: 'text-status-backlog',
    dot: 'bg-status-backlog',
    color: 'var(--status-backlog)',
  },
  todo: {
    label: 'To Do',
    icon: Circle,
    text: 'text-status-todo',
    dot: 'bg-status-todo',
    color: 'var(--status-todo)',
  },
  in_progress: {
    label: 'In Progress',
    icon: CircleDotDashed,
    text: 'text-status-in-progress',
    dot: 'bg-status-in-progress',
    color: 'var(--status-in-progress)',
  },
  in_review: {
    label: 'In Review',
    icon: ScanEye,
    text: 'text-status-in-review',
    dot: 'bg-status-in-review',
    color: 'var(--status-in-review)',
  },
  done: {
    label: 'Done',
    icon: CircleCheck,
    text: 'text-status-done',
    dot: 'bg-status-done',
    color: 'var(--status-done)',
  },
}

export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low']

export const PRIORITY: Record<Priority, Meta> = {
  urgent: {
    label: 'Urgent',
    icon: TriangleAlert,
    text: 'text-priority-urgent',
    dot: 'bg-priority-urgent',
    color: 'var(--priority-urgent)',
  },
  high: {
    label: 'High',
    icon: SignalHigh,
    text: 'text-priority-high',
    dot: 'bg-priority-high',
    color: 'var(--priority-high)',
  },
  medium: {
    label: 'Medium',
    icon: SignalMedium,
    text: 'text-priority-medium',
    dot: 'bg-priority-medium',
    color: 'var(--priority-medium)',
  },
  low: {
    label: 'Low',
    icon: SignalLow,
    text: 'text-priority-low',
    dot: 'bg-priority-low',
    color: 'var(--priority-low)',
  },
}

export const ISSUE_TYPE_ORDER: IssueType[] = ['bug', 'feature', 'improvement', 'question']

export const ISSUE_TYPE: Record<IssueType, Meta> = {
  bug: {
    label: 'Bug',
    icon: Bug,
    text: 'text-type-bug',
    dot: 'bg-type-bug',
    color: 'var(--type-bug)',
  },
  feature: {
    label: 'Feature request',
    icon: Lightbulb,
    text: 'text-type-feature',
    dot: 'bg-type-feature',
    color: 'var(--type-feature)',
  },
  improvement: {
    label: 'Improvement',
    icon: Wrench,
    text: 'text-type-improvement',
    dot: 'bg-type-improvement',
    color: 'var(--type-improvement)',
  },
  question: {
    label: 'Question',
    icon: MessageCircleQuestionMark,
    text: 'text-type-question',
    dot: 'bg-type-question',
    color: 'var(--type-question)',
  },
}

export const ISSUE_STATUS_ORDER: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed']
export const OPEN_ISSUE_STATUSES: IssueStatus[] = ['open', 'in_progress']
export const CLOSED_ISSUE_STATUSES: IssueStatus[] = ['resolved', 'closed']

export const ISSUE_STATUS: Record<IssueStatus, Meta> = {
  open: {
    label: 'Open',
    icon: CircleDot,
    text: 'text-status-done',
    dot: 'bg-status-done',
    color: 'var(--status-done)',
  },
  in_progress: {
    label: 'In Progress',
    icon: CircleDotDashed,
    text: 'text-status-in-progress',
    dot: 'bg-status-in-progress',
    color: 'var(--status-in-progress)',
  },
  resolved: {
    label: 'Resolved',
    icon: CircleCheck,
    text: 'text-status-in-review',
    dot: 'bg-status-in-review',
    color: 'var(--status-in-review)',
  },
  closed: {
    label: 'Closed',
    icon: CircleSlash,
    text: 'text-subtle',
    dot: 'bg-subtle',
    color: 'var(--subtle)',
  },
}

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'archived',
]

export const PROJECT_STATUS: Record<ProjectStatus, Omit<Meta, 'icon'>> = {
  planning: {
    label: 'Planning',
    text: 'text-status-todo',
    dot: 'bg-status-todo',
    color: 'var(--status-todo)',
  },
  active: {
    label: 'Active',
    text: 'text-status-done',
    dot: 'bg-status-done',
    color: 'var(--status-done)',
  },
  on_hold: {
    label: 'On Hold',
    text: 'text-status-in-progress',
    dot: 'bg-status-in-progress',
    color: 'var(--status-in-progress)',
  },
  completed: {
    label: 'Completed',
    text: 'text-status-in-review',
    dot: 'bg-status-in-review',
    color: 'var(--status-in-review)',
  },
  archived: { label: 'Archived', text: 'text-subtle', dot: 'bg-subtle', color: 'var(--subtle)' },
}

export const PROJECT_COLOR_ORDER: ProjectColor[] = [
  'indigo',
  'violet',
  'sky',
  'teal',
  'emerald',
  'amber',
  'rose',
  'slate',
]

export const PROJECT_COLOR: Record<ProjectColor, { label: string; dot: string; color: string }> = {
  indigo: { label: 'Indigo', dot: 'bg-project-indigo', color: 'var(--project-indigo)' },
  violet: { label: 'Violet', dot: 'bg-project-violet', color: 'var(--project-violet)' },
  sky: { label: 'Sky', dot: 'bg-project-sky', color: 'var(--project-sky)' },
  teal: { label: 'Teal', dot: 'bg-project-teal', color: 'var(--project-teal)' },
  emerald: { label: 'Emerald', dot: 'bg-project-emerald', color: 'var(--project-emerald)' },
  amber: { label: 'Amber', dot: 'bg-project-amber', color: 'var(--project-amber)' },
  rose: { label: 'Rose', dot: 'bg-project-rose', color: 'var(--project-rose)' },
  slate: { label: 'Slate', dot: 'bg-project-slate', color: 'var(--project-slate)' },
}
