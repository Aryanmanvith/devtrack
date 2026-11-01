import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  CircleCheck,
  CircleDot,
  CircleSlash,
  Database,
  FolderPlus,
  ListPlus,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { ProjectLink } from '@/components/common/entity'
import { useIssueDrawer, useTaskDrawer } from '@/hooks/use-drawers'
import type { Activity } from '@/lib/api/types'
import { formatDateTime, relativeTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

const EVENT_ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  'project.created': { icon: FolderPlus, tone: 'text-accent-text' },
  'project.updated': { icon: Pencil, tone: 'text-muted' },
  'project.status_changed': { icon: RefreshCw, tone: 'text-muted' },
  'project.archived': { icon: Archive, tone: 'text-subtle' },
  'project.restored': { icon: ArchiveRestore, tone: 'text-accent-text' },
  'project.deleted': { icon: Trash2, tone: 'text-danger' },
  'task.created': { icon: ListPlus, tone: 'text-accent-text' },
  'task.updated': { icon: Pencil, tone: 'text-muted' },
  'task.status_changed': { icon: ArrowRightLeft, tone: 'text-status-in-progress' },
  'task.completed': { icon: CircleCheck, tone: 'text-status-done' },
  'task.deleted': { icon: Trash2, tone: 'text-danger' },
  'issue.created': { icon: CircleDot, tone: 'text-status-done' },
  'issue.updated': { icon: Pencil, tone: 'text-muted' },
  'issue.status_changed': { icon: ArrowRightLeft, tone: 'text-status-in-progress' },
  'issue.resolved': { icon: CircleCheck, tone: 'text-status-in-review' },
  'issue.closed': { icon: CircleSlash, tone: 'text-subtle' },
  'issue.reopened': { icon: RotateCcw, tone: 'text-status-done' },
  'issue.deleted': { icon: Trash2, tone: 'text-danger' },
  'demo.seeded': { icon: Database, tone: 'text-violet' },
  'demo.removed': { icon: Database, tone: 'text-subtle' },
}

const ENTITY_NOUN = { project: 'project', task: 'task', issue: 'issue', system: 'record' } as const

export function ActivityItem({
  activity,
  showProject = true,
  linkEntity = true,
}: {
  activity: Activity
  showProject?: boolean
  linkEntity?: boolean
}) {
  const navigate = useNavigate()
  const taskDrawer = useTaskDrawer()
  const issueDrawer = useIssueDrawer()
  const visual = EVENT_ICONS[activity.event_type] ?? { icon: Pencil, tone: 'text-muted' }
  const Icon = visual.icon
  const { entity_type: type, entity_id: id } = activity
  const deleted = activity.entity_exists === false

  let openEntity: (() => void) | null = null
  if (linkEntity && activity.entity_exists && id !== null) {
    if (type === 'project') openEntity = () => navigate(`/projects/${id}`)
    else if (type === 'task') openEntity = () => taskDrawer.open(id)
    else if (type === 'issue') openEntity = () => issueDrawer.open(id)
  }

  return (
    <li className="flex gap-3 py-2.5">
      <div className="mt-px flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2">
        <Icon className={cn('size-3.5', visual.tone)} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        {openEntity ? (
          <button
            type="button"
            onClick={openEntity}
            className="rounded-sm text-left text-[13px] leading-snug text-foreground hover:text-accent-text hover:underline hover:underline-offset-4"
            title={`Open ${ENTITY_NOUN[type]}`}
          >
            {activity.description}
          </button>
        ) : (
          <p className="text-[13px] leading-snug text-foreground">{activity.description}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtle">
          <time dateTime={activity.created_at} title={formatDateTime(activity.created_at)}>
            {relativeTime(activity.created_at)}
          </time>
          {showProject && activity.project && type !== 'project' ? (
            <ProjectLink project={activity.project} className="text-[12px]" />
          ) : null}
          {deleted ? (
            <span
              className="text-subtle"
              title={`This ${ENTITY_NOUN[type]} has since been deleted`}
            >
              {ENTITY_NOUN[type][0]?.toUpperCase()}
              {ENTITY_NOUN[type].slice(1)} deleted
            </span>
          ) : null}
        </div>
      </div>
    </li>
  )
}
