import { CalendarClock } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import type {
  IssueStatus,
  IssueType,
  Priority,
  ProjectBrief,
  ProjectColor,
  ProjectStatus,
  TaskStatus,
} from '@/lib/api/types'
import { describeDue, formatDayLong } from '@/lib/dates'
import {
  ISSUE_STATUS,
  ISSUE_TYPE,
  PRIORITY,
  PROJECT_COLOR,
  PROJECT_STATUS,
  TASK_STATUS,
} from '@/lib/meta'
import { cn } from '@/lib/utils'

export function TaskStatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = TASK_STATUS[status]
  const Icon = meta.icon
  return <Icon className={cn('size-4 shrink-0', meta.text, className)} aria-hidden />
}

export function TaskStatusLabel({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] text-muted', className)}>
      <TaskStatusIcon status={status} className="size-3.5" />
      {TASK_STATUS[status].label}
    </span>
  )
}

export function PriorityLabel({
  priority,
  compact = false,
  className,
}: {
  priority: Priority
  compact?: boolean
  className?: string
}) {
  const meta = PRIORITY[priority]
  const Icon = meta.icon
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-[12.5px] text-muted', className)}
      title={compact ? `${meta.label} priority` : undefined}
    >
      <Icon className={cn('size-3.5 shrink-0', meta.text)} aria-hidden />
      {compact ? <span className="sr-only">{meta.label} priority</span> : meta.label}
    </span>
  )
}

export function IssueTypeIcon({ type, className }: { type: IssueType; className?: string }) {
  const meta = ISSUE_TYPE[type]
  const Icon = meta.icon
  return <Icon className={cn('size-4 shrink-0', meta.text, className)} aria-hidden />
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const meta = ISSUE_STATUS[status]
  const Icon = meta.icon
  return (
    <Badge variant="neutral" className="gap-1.5">
      <Icon className={meta.text} aria-hidden />
      {meta.label}
    </Badge>
  )
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS[status]
  return (
    <Badge variant="neutral" className="gap-1.5">
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  )
}

export function ProjectDot({ color, className }: { color: ProjectColor; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-[3px]',
        PROJECT_COLOR[color].dot,
        className,
      )}
      aria-hidden
    />
  )
}

export function ProjectLink({
  project,
  className,
  stopPropagation = false,
}: {
  project: ProjectBrief
  className?: string
  stopPropagation?: boolean
}) {
  return (
    <Link
      to={`/projects/${project.id}`}
      onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 rounded-sm text-[12.5px] text-muted transition-colors hover:text-foreground hover:underline hover:underline-offset-4',
        className,
      )}
    >
      <ProjectDot color={project.color} />
      <span className="truncate">{project.name}</span>
    </Link>
  )
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="demo" className={className} title="Sample record from the demo workspace">
      Demo
    </Badge>
  )
}

const DUE_TONE: Record<string, string> = {
  overdue: 'text-danger',
  today: 'text-warning',
  soon: 'text-foreground',
  later: 'text-muted',
  done: 'text-subtle line-through decoration-1',
}

export function DueDate({
  due,
  done,
  className,
  showIcon = true,
}: {
  due: string | null
  done: boolean
  className?: string
  showIcon?: boolean
}) {
  const state = describeDue(due, done)
  if (!state || !due)
    return <span className={cn('text-[12.5px] text-subtle', className)}>No deadline</span>
  return (
    <time
      dateTime={due}
      title={formatDayLong(due)}
      className={cn(
        'inline-flex items-center gap-1 text-[12.5px] whitespace-nowrap tabular',
        DUE_TONE[state.tone],
        className,
      )}
    >
      {showIcon ? <CalendarClock className="size-3.5 shrink-0 opacity-80" aria-hidden /> : null}
      {state.label}
    </time>
  )
}

export function LabelChips({ labels, max = 3 }: { labels: string[]; max?: number }) {
  if (labels.length === 0) return null
  const shown = labels.slice(0, max)
  const hidden = labels.length - shown.length
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((label) => (
        <span
          key={label}
          className="rounded-[5px] border border-border bg-surface-2 px-1.5 text-[11px] leading-[18px] text-muted"
        >
          {label}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="text-[11px] text-subtle" title={labels.slice(max).join(', ')}>
          +{hidden}
        </span>
      ) : null}
    </span>
  )
}
