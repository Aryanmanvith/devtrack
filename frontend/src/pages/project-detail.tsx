import {
  CircleAlert,
  FileQuestion,
  History,
  Inbox,
  ListPlus,
  Pencil,
  SquareKanban,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ActivityItem } from '@/components/activity/activity-item'
import {
  DemoBadge,
  DueDate,
  IssueStatusBadge,
  IssueTypeIcon,
  PriorityLabel,
  ProjectStatusBadge,
} from '@/components/common/entity'
import { PageContainer } from '@/components/common/page'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states'
import { IssueActionsMenu } from '@/components/issues/issue-controls'
import { ProjectActionsMenu } from '@/components/projects/project-actions'
import { CompleteToggle, TaskActionsMenu, TaskStatusMenu } from '@/components/tasks/task-controls'
import { Button } from '@/components/ui/button'
import {
  Panel,
  ProgressBar,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/misc'
import { useActivity, useIssues, useProject, useTasks } from '@/hooks/queries'
import { useIssueDrawer, useTaskDrawer } from '@/hooks/use-drawers'
import { useUpdateSearchParams } from '@/hooks/use-utils'
import { ApiError } from '@/lib/api/client'
import type { Project } from '@/lib/api/types'
import { formatDateTime, formatDayLong, isOverdue, relativeTime } from '@/lib/dates'
import { positiveInt } from '@/lib/filters'
import { PROJECT_COLOR, TASK_STATUS, TASK_STATUS_ORDER } from '@/lib/meta'
import { cn, plural } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] text-foreground">{children}</dd>
    </div>
  )
}

function ProjectTasks({ project }: { project: Project }) {
  const tasks = useTasks({ project_id: project.id, sort: 'due_date', limit: 500 })
  const drawer = useTaskDrawer()
  const dialogs = useDialogs()
  if (tasks.isPending) return <RowsSkeleton rows={5} />
  if (tasks.isError)
    return <ErrorState compact error={tasks.error} onRetry={() => tasks.refetch()} />
  if (tasks.data.items.length === 0)
    return (
      <EmptyState
        compact
        icon={Inbox}
        title="No tasks in this project"
        description="Break the project into tasks to track progress."
        action={
          project.status !== 'archived' ? (
            <Button size="sm" onClick={() => dialogs.createTask({ projectId: project.id })}>
              Create task
            </Button>
          ) : undefined
        }
      />
    )
  return (
    <ul className="divide-y divide-border" aria-label={`Tasks in ${project.name}`}>
      {tasks.data.items.map((task) => (
        <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
          <CompleteToggle task={task} />
          <button
            type="button"
            onClick={() => drawer.open(task.id)}
            className={cn(
              'min-w-0 flex-1 truncate rounded-sm text-left text-[13.5px] hover:text-accent-text',
              task.status === 'done' ? 'text-subtle line-through' : 'text-foreground',
            )}
          >
            {task.title}
          </button>
          <TaskStatusMenu task={task} showLabel className="hidden sm:inline-flex" />
          <PriorityLabel priority={task.priority} compact />
          <DueDate
            due={task.due_date}
            done={task.status === 'done'}
            className="hidden w-32 justify-end md:inline-flex"
          />
          <TaskActionsMenu task={task} />
        </li>
      ))}
    </ul>
  )
}

function ProjectIssues({ project }: { project: Project }) {
  const issues = useIssues({ project_id: project.id, limit: 500 })
  const drawer = useIssueDrawer()
  const dialogs = useDialogs()
  if (issues.isPending) return <RowsSkeleton rows={4} />
  if (issues.isError)
    return <ErrorState compact error={issues.error} onRetry={() => issues.refetch()} />
  if (issues.data.items.length === 0)
    return (
      <EmptyState
        compact
        icon={CircleAlert}
        title="No issues reported"
        description="Track bugs, feature requests and open questions for this project."
        action={
          project.status !== 'archived' ? (
            <Button size="sm" onClick={() => dialogs.createIssue({ projectId: project.id })}>
              Create issue
            </Button>
          ) : undefined
        }
      />
    )
  return (
    <ul className="divide-y divide-border" aria-label={`Issues in ${project.name}`}>
      {issues.data.items.map((issue) => (
        <li key={issue.id} className="flex items-center gap-3 px-4 py-2.5">
          <IssueTypeIcon type={issue.type} />
          <button
            type="button"
            onClick={() => drawer.open(issue.id)}
            className="min-w-0 flex-1 truncate rounded-sm text-left text-[13.5px] text-foreground hover:text-accent-text"
          >
            {issue.title}
          </button>
          <IssueStatusBadge status={issue.status} />
          <PriorityLabel priority={issue.priority} compact />
          <span className="hidden w-24 text-right text-[12px] text-subtle md:inline">
            {relativeTime(issue.created_at)}
          </span>
          <IssueActionsMenu issue={issue} />
        </li>
      ))}
    </ul>
  )
}

function ProjectActivity({ project }: { project: Project }) {
  const activity = useActivity({ project_id: project.id, limit: 30 })
  if (activity.isPending) return <RowsSkeleton rows={4} />
  if (activity.isError)
    return <ErrorState compact error={activity.error} onRetry={() => activity.refetch()} />
  if (activity.data.items.length === 0)
    return (
      <EmptyState
        compact
        icon={History}
        title="No activity yet"
        description="Changes to this project appear here."
      />
    )
  return (
    <ul className="divide-y divide-border px-4">
      {activity.data.items.map((item) => (
        <ActivityItem key={item.id} activity={item} showProject={false} />
      ))}
    </ul>
  )
}

const TABS = ['tasks', 'issues', 'activity'] as const

export function ProjectDetailPage() {
  const params = useParams()
  const projectId = positiveInt(params.projectId ?? null)
  const project = useProject(projectId)
  const tasks = useTasks(
    { project_id: projectId ?? undefined, sort: 'due_date', limit: 500 },
    projectId !== null,
  )
  const navigate = useNavigate()
  const dialogs = useDialogs()
  const [search] = useSearchParams()
  const update = useUpdateSearchParams()
  const tab = TABS.find((t) => t === search.get('tab')) ?? 'tasks'

  if (projectId === null || (project.error instanceof ApiError && project.error.isNotFound)) {
    return (
      <PageContainer>
        <Panel>
          <EmptyState
            icon={FileQuestion}
            title="Project not found"
            description="It may have been deleted, or the link is out of date."
            action={
              <Button asChild>
                <Link to="/projects">Back to projects</Link>
              </Button>
            }
          />
        </Panel>
      </PageContainer>
    )
  }
  if (project.isError) {
    return (
      <PageContainer>
        <Panel>
          <ErrorState error={project.error} onRetry={() => project.refetch()} />
        </Panel>
      </PageContainer>
    )
  }
  if (!project.data) {
    return (
      <PageContainer>
        <Skeleton className="mb-3 h-5 w-40" />
        <Skeleton className="mb-6 h-9 w-80" />
        <Skeleton className="h-40 w-full rounded-[14px]" />
      </PageContainer>
    )
  }

  const p = project.data
  const archived = p.status === 'archived'
  const late = isOverdue(p.due_date, p.status === 'completed' || archived)
  const counts = TASK_STATUS_ORDER.map((status) => ({
    status,
    count: tasks.data?.items.filter((task) => task.status === status).length ?? 0,
  }))

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="size-3 rounded-[4px]"
              style={{ background: PROJECT_COLOR[p.color].color }}
              aria-hidden
            />
            <ProjectStatusBadge status={p.status} />
            {p.is_demo ? <DemoBadge /> : null}
          </div>
          <h1 className="text-[26px] leading-tight font-semibold font-display text-foreground sm:text-[30px]">
            {p.name}
          </h1>
          <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-muted">
            {p.description || 'No description yet.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild>
            <Link to={`/board?project=${p.id}`}>
              <SquareKanban aria-hidden />
              Open board
            </Link>
          </Button>
          <Button onClick={() => dialogs.editProject(p)}>
            <Pencil aria-hidden />
            Edit
          </Button>
          {!archived ? (
            <Button variant="primary" onClick={() => dialogs.createTask({ projectId: p.id })}>
              <ListPlus aria-hidden />
              Create task
            </Button>
          ) : null}
          <ProjectActionsMenu
            project={p}
            showOpen={false}
            triggerVariant="button"
            onDeleted={() => navigate('/projects')}
          />
        </div>
      </div>

      {archived ? (
        <p className="mb-5 rounded-lg border border-dashed border-border-strong px-4 py-2.5 text-[13px] text-muted">
          This project is archived. Its tasks and issues are hidden from boards, lists and metrics.
          Restore it from the actions menu to work on it again.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="p-5 lg:col-span-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12.5px] text-muted">Progress</p>
              <p className="text-[30px] leading-tight font-semibold font-display text-foreground tabular">
                {p.progress}%
              </p>
            </div>
            <p className="text-[12.5px] text-muted tabular">
              {p.completed_task_count} of {plural(p.task_count, 'task')} done
              {p.overdue_task_count ? (
                <span className="text-danger">, {p.overdue_task_count} overdue</span>
              ) : null}
            </p>
          </div>
          <ProgressBar
            value={p.progress}
            label={`${p.name} progress`}
            className="mt-3 h-2"
            color={PROJECT_COLOR[p.color].color}
          />
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Tasks by status">
            {counts.map(({ status, count }) => (
              <li key={status}>
                <Link
                  to={`/tasks?project=${p.id}&status=${status}`}
                  aria-label={`${TASK_STATUS[status].label}: ${plural(count, 'task')}. View them`}
                  className="block rounded-lg border border-border bg-surface-2/50 px-3 py-2 transition-colors hover:border-border-strong hover:bg-surface-2"
                >
                  <span className="block text-[11.5px] text-subtle">
                    {TASK_STATUS[status].label}
                  </span>
                  <span className="block text-[16px] font-semibold text-foreground tabular">
                    {count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="p-5 lg:col-span-4">
          <dl className="grid grid-cols-2 gap-4">
            <Fact label="Owner">{p.owner ?? <span className="text-subtle">Not set</span>}</Fact>
            <Fact label="Open issues">{p.open_issue_count}</Fact>
            <Fact label="Start date">
              {p.start_date ? (
                formatDayLong(p.start_date)
              ) : (
                <span className="text-subtle">Not set</span>
              )}
            </Fact>
            <Fact label="Deadline">
              {p.due_date ? (
                <span className={cn(late && 'text-danger')}>
                  {formatDayLong(p.due_date)}
                  {late ? ' (overdue)' : ''}
                </span>
              ) : (
                <span className="text-subtle">Not set</span>
              )}
            </Fact>
            <Fact label="Created">{formatDateTime(p.created_at)}</Fact>
            <Fact label="Last updated">{relativeTime(p.updated_at)}</Fact>
          </dl>
        </Panel>
      </div>

      <Panel className="mt-5 overflow-hidden">
        <Tabs
          value={tab}
          onValueChange={(value) => update({ tab: value === 'tasks' ? null : value })}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2">
            <TabsList className="border-b-0">
              <TabsTrigger value="tasks">Tasks ({p.task_count})</TabsTrigger>
              <TabsTrigger value="issues">Issues ({p.open_issue_count} open)</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            {!archived ? (
              tab === 'issues' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dialogs.createIssue({ projectId: p.id })}
                >
                  <CircleAlert aria-hidden />
                  Create issue
                </Button>
              ) : tab === 'tasks' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dialogs.createTask({ projectId: p.id })}
                >
                  <ListPlus aria-hidden />
                  Create task
                </Button>
              ) : null
            ) : null}
          </div>
          <div className="border-t border-border">
            <TabsContent value="tasks">
              <ProjectTasks project={p} />
            </TabsContent>
            <TabsContent value="issues">
              <ProjectIssues project={p} />
            </TabsContent>
            <TabsContent value="activity">
              <ProjectActivity project={p} />
            </TabsContent>
          </div>
        </Tabs>
      </Panel>
    </PageContainer>
  )
}
