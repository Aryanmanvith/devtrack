import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FolderKanban,
  FolderPlus,
  History,
  Inbox,
  ListPlus,
  PieChart as PieIcon,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ActivityItem } from '@/components/activity/activity-item'
import { CompletionTrendChart, DonutChart, SeriesToggles } from '@/components/charts/charts'
import type { TrendSeries } from '@/components/charts/series'
import {
  DemoBadge,
  DueDate,
  PriorityLabel,
  ProjectDot,
  ProjectLink,
  ProjectStatusBadge,
} from '@/components/common/entity'
import { PageContainer } from '@/components/common/page'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states'
import { ProjectActionsMenu } from '@/components/projects/project-actions'
import { TaskStatusMenu } from '@/components/tasks/task-controls'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader, ProgressBar, Segmented, Skeleton } from '@/components/ui/misc'
import {
  useActivity,
  useCompletionTrend,
  useDashboardSummary,
  useDeadlines,
  useDemoStatus,
  usePreferences,
  useProjects,
  useTaskDistribution,
  useTasks,
} from '@/hooks/queries'
import { useTaskDrawer } from '@/hooks/use-drawers'
import { useLocalStorageFlag } from '@/hooks/use-utils'
import type { DashboardSummary } from '@/lib/api/types'
import { dayOfMonth, formatDay, greeting, isOverdue, monthShort, rangeLabel } from '@/lib/dates'
import {
  OPEN_TASK_STATUSES,
  PRIORITY,
  PRIORITY_ORDER,
  TASK_STATUS,
  TASK_STATUS_ORDER,
} from '@/lib/meta'
import { cn, plural } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'

// ---- Header ----------------------------------------------------------------------------------

function SummaryLink({ to, children, tone }: { to: string; children: ReactNode; tone?: 'danger' }) {
  return (
    <Link
      to={to}
      className={cn(
        'font-medium underline decoration-1 underline-offset-[5px] transition-colors hover:decoration-2',
        tone === 'danger'
          ? 'text-danger decoration-danger/50'
          : 'text-foreground decoration-border-strong hover:decoration-primary',
      )}
    >
      {children}
    </Link>
  )
}

function SummarySentence({ summary }: { summary: DashboardSummary }) {
  if (summary.total_projects === 0 && summary.total_tasks === 0) {
    return <>Your workspace is empty. Create a project to start planning your work.</>
  }
  const weekday = formatDay(summary.week_end)
  const overdue = summary.overdue_tasks
  const dueWeek = summary.due_this_week
  return (
    <>
      {overdue > 0 ? (
        <SummaryLink to="/tasks?due=overdue" tone="danger">
          {plural(overdue, 'task')} {overdue === 1 ? 'is' : 'are'} overdue
        </SummaryLink>
      ) : (
        'Nothing is overdue'
      )}
      {dueWeek > 0 ? (
        <>
          {overdue > 0 ? ' and ' : ', and '}
          <SummaryLink to="/tasks?due=this_week&status=open">
            {plural(dueWeek, 'task')} {dueWeek === 1 ? 'is' : 'are'} due by {weekday}
          </SummaryLink>
          .
        </>
      ) : (
        <>{overdue > 0 ? '. Nothing else is due this week.' : ' or due this week.'}</>
      )}{' '}
      You have{' '}
      <SummaryLink to="/tasks?status=open">{plural(summary.open_tasks, 'open task')}</SummaryLink>{' '}
      across{' '}
      <SummaryLink to="/projects?status=active">
        {plural(summary.active_projects, 'active project')}
      </SummaryLink>
      .
    </>
  )
}

function DashboardHeader() {
  const preferences = usePreferences()
  const summary = useDashboardSummary()
  const dialogs = useDialogs()
  const name = preferences.data?.display_name
  return (
    <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-semibold font-display text-foreground sm:text-[32px]">
          {greeting()}
          {name ? `, ${name}` : ''}
        </h1>
        {summary.data ? (
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
            <SummarySentence summary={summary.data} />
          </p>
        ) : summary.isError ? (
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
            Your summary could not be loaded. Check that the backend is running.
          </p>
        ) : (
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="primary" onClick={dialogs.createProject}>
          <FolderPlus aria-hidden />
          Create project
        </Button>
        <Button onClick={() => dialogs.createTask()}>
          <ListPlus aria-hidden />
          Create task
        </Button>
      </div>
    </div>
  )
}

function DemoNotice() {
  const demo = useDemoStatus()
  const [dismissed, setDismissed] = useLocalStorageFlag('devtrack-demo-notice-dismissed', false)
  if (!demo.data?.has_demo_data || dismissed) return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-border-strong px-4 py-3 text-[13px] text-muted">
      <DemoBadge />
      <p className="min-w-[15rem] flex-1">
        This workspace includes sample projects, tasks and issues so the charts have history. They
        are marked Demo and can be removed whenever you are ready.
      </p>
      <Link
        to="/settings#demo-data"
        className="shrink-0 font-medium text-accent-text hover:underline hover:underline-offset-4"
      >
        Manage demo data
      </Link>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss demo data notice"
        onClick={() => setDismissed(true)}
      >
        <X aria-hidden />
      </Button>
    </div>
  )
}

// ---- KPI strip -------------------------------------------------------------------------------

interface Kpi {
  label: string
  value: number
  note: string
  to: string
  linkLabel: string
  tone?: 'danger' | 'success'
}

function kpis(summary: DashboardSummary): Kpi[] {
  const change = summary.completed_this_week - summary.completed_last_week
  return [
    {
      label: 'Active projects',
      value: summary.active_projects,
      note: `${plural(summary.total_projects, 'project')} in total, excluding archived`,
      to: '/projects?status=active',
      linkLabel: 'View active projects',
    },
    {
      label: 'Open tasks',
      value: summary.open_tasks,
      note: `${summary.in_progress_tasks} in progress right now`,
      to: '/tasks?status=open',
      linkLabel: 'View open tasks',
    },
    {
      label: 'Completed this week',
      value: summary.completed_this_week,
      note:
        change === 0
          ? `Same as last week (${summary.completed_last_week})`
          : `${change > 0 ? '+' : ''}${change} compared with last week`,
      to: `/tasks?status=done&completed_from=${summary.week_start}&completed_to=${summary.week_end}`,
      linkLabel: 'View tasks completed this week',
      tone: summary.completed_this_week > 0 ? 'success' : undefined,
    },
    {
      label: 'Overdue tasks',
      value: summary.overdue_tasks,
      note: summary.overdue_tasks
        ? 'Past their deadline and not done'
        : 'Every deadline is on track',
      to: '/tasks?due=overdue',
      linkLabel: 'View overdue tasks',
      tone: summary.overdue_tasks ? 'danger' : undefined,
    },
  ]
}

function KpiStrip() {
  const summary = useDashboardSummary()
  if (summary.isError) {
    return (
      <Panel>
        <ErrorState compact error={summary.error} onRetry={() => summary.refetch()} />
      </Panel>
    )
  }
  const items = summary.data ? kpis(summary.data) : null
  return (
    <Panel className="grid grid-cols-2 overflow-hidden lg:grid-cols-4" aria-label="Key metrics">
      {(items ?? Array.from({ length: 4 }, () => null)).map((kpi, index) => (
        <div
          key={kpi?.label ?? index}
          className={cn(
            'border-border',
            index % 2 === 0 && 'border-r',
            index < 2 && 'border-b lg:border-b-0',
            index === 1 && 'lg:border-r',
            index === 2 && 'lg:border-r',
          )}
        >
          {kpi ? (
            <Link
              to={kpi.to}
              aria-label={`${kpi.label}: ${kpi.value}. ${kpi.linkLabel}`}
              className="group flex h-full flex-col gap-1 px-5 py-4 transition-colors hover:bg-surface-2/70 focus-visible:-outline-offset-2"
            >
              <span className="text-[12.5px] text-muted group-hover:text-foreground">
                {kpi.label}
              </span>
              <span
                className={cn(
                  'text-[34px] leading-tight font-semibold font-display tabular',
                  kpi.tone === 'danger' ? 'text-danger' : 'text-foreground',
                )}
              >
                {kpi.value}
              </span>
              <span
                className={cn(
                  'text-[12px]',
                  kpi.tone === 'success' ? 'text-success' : 'text-subtle',
                )}
              >
                {kpi.note}
              </span>
            </Link>
          ) : (
            <div className="flex flex-col gap-2 px-5 py-4">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-14" />
              <Skeleton className="h-3 w-32" />
            </div>
          )}
        </div>
      ))}
    </Panel>
  )
}

// ---- Completion trend ------------------------------------------------------------------------

const RANGE_OPTIONS = [
  { value: '4', label: '4w', title: 'Last 4 weeks' },
  { value: '8', label: '8w', title: 'Last 8 weeks' },
  { value: '12', label: '12w', title: 'Last 12 weeks' },
]

function TrendPanel({ className }: { className?: string }) {
  const [weeks, setWeeks] = useState(8)
  const [picked, setPicked] = useState<{ weeks: number; index: number } | null>(null)
  const [hidden, setHidden] = useState<ReadonlySet<TrendSeries>>(new Set())
  const trend = useCompletionTrend(weeks)
  const points = trend.data?.points ?? []
  const index =
    picked && picked.weeks === weeks ? Math.min(picked.index, points.length - 1) : points.length - 1
  const point = points[index]
  const empty =
    trend.data !== undefined && points.every((p) => p.completed === 0 && p.remaining === 0)

  const toggle = (series: TrendSeries) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(series)) next.delete(series)
      else next.add(series)
      return next
    })

  return (
    <Panel className={className} aria-labelledby="trend-title">
      <PanelHeader
        titleId="trend-title"
        title="Completion trend"
        description="Tasks completed each week, and tasks still open at the end of each week"
        actions={
          <Segmented
            label="Date range"
            value={String(weeks)}
            onChange={(value) => setWeeks(Number(value))}
            options={RANGE_OPTIONS}
          />
        }
      />
      {trend.isPending ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-[240px] w-full" />
        </div>
      ) : trend.isError ? (
        <ErrorState compact error={trend.error} onRetry={() => trend.refetch()} />
      ) : empty ? (
        <EmptyState
          compact
          icon={CircleCheck}
          title="No task history yet"
          description="Create tasks and mark them done; each completed task appears here in the week it was finished."
        />
      ) : (
        <>
          <div className="px-5">
            <SeriesToggles series={['completed', 'remaining']} hidden={hidden} onToggle={toggle} />
          </div>
          <figure className="px-3 pt-1" aria-label={`Completion trend for the last ${weeks} weeks`}>
            <CompletionTrendChart
              points={points}
              selectedIndex={index}
              hidden={hidden}
              onSelect={(next) => setPicked({ weeks, index: next })}
            />
          </figure>
          {point ? (
            <div className="mx-5 mt-2 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Previous week"
                  disabled={index <= 0}
                  onClick={() => setPicked({ weeks, index: index - 1 })}
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Next week"
                  disabled={index >= points.length - 1}
                  onClick={() => setPicked({ weeks, index: index + 1 })}
                >
                  <ChevronRight aria-hidden />
                </Button>
              </div>
              <p className="text-[12.5px] text-muted" aria-live="polite">
                <span className="font-medium text-foreground">
                  Week of {rangeLabel(point.week_start, point.week_end)}
                </span>
                {index === points.length - 1 ? ' (this week)' : ''}: {point.completed} completed,{' '}
                {point.remaining} still open, {point.created} created
              </p>
              <Link
                to={`/tasks?status=done&completed_from=${point.week_start}&completed_to=${point.week_end}`}
                className="ml-auto text-[12.5px] font-medium text-accent-text hover:underline hover:underline-offset-4"
              >
                View completed tasks
              </Link>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  )
}

// ---- Distribution ----------------------------------------------------------------------------

function DistributionPanel({ className }: { className?: string }) {
  const [mode, setMode] = useState<'status' | 'priority'>('status')
  const distribution = useTaskDistribution()
  const navigate = useNavigate()
  const dialogs = useDialogs()
  const data = distribution.data

  const slices =
    mode === 'status'
      ? TASK_STATUS_ORDER.map((status) => ({
          key: status,
          label: TASK_STATUS[status].label,
          color: TASK_STATUS[status].color,
          count: data?.by_status.find((item) => item.key === status)?.count ?? 0,
        }))
      : PRIORITY_ORDER.map((priority) => ({
          key: priority,
          label: PRIORITY[priority].label,
          color: PRIORITY[priority].color,
          count: data?.by_priority.find((item) => item.key === priority)?.count ?? 0,
        }))
  const total = mode === 'status' ? (data?.total ?? 0) : (data?.open_total ?? 0)
  const linkFor = (key: string) =>
    mode === 'status' ? `/tasks?status=${key}` : `/tasks?status=open&priority=${key}`

  return (
    <Panel className={className} aria-labelledby="distribution-title">
      <PanelHeader
        titleId="distribution-title"
        title="Task distribution"
        description={mode === 'status' ? 'All tasks by status' : 'Open tasks by priority'}
        actions={
          <Segmented
            label="Group tasks by"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'status', label: 'Status' },
              { value: 'priority', label: 'Priority' },
            ]}
          />
        }
      />
      {distribution.isPending ? (
        <div className="flex justify-center p-6">
          <Skeleton className="size-44 rounded-full" />
        </div>
      ) : distribution.isError ? (
        <ErrorState compact error={distribution.error} onRetry={() => distribution.refetch()} />
      ) : total === 0 ? (
        <EmptyState
          compact
          icon={PieIcon}
          title={mode === 'status' ? 'No tasks yet' : 'No open tasks'}
          description={
            mode === 'status' ? 'The chart fills in as you add tasks.' : 'Everything is done.'
          }
          action={
            mode === 'status' ? (
              <Button size="sm" onClick={() => dialogs.createTask()}>
                Create task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="px-5 pb-4">
          <DonutChart
            slices={slices}
            total={total}
            centerLabel={mode === 'status' ? 'tasks' : 'open tasks'}
            onSelect={(key) => navigate(linkFor(key))}
          />
          <ul className="mt-3 flex flex-col gap-0.5" aria-label="Distribution legend">
            {slices.map((slice) => (
              <li key={slice.key}>
                <Link
                  to={linkFor(slice.key)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2"
                  aria-label={`${slice.label}: ${plural(slice.count, 'task')}. View these tasks`}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: slice.color }}
                    aria-hidden
                  />
                  <span className="flex-1 text-muted">{slice.label}</span>
                  <span className="font-medium text-foreground tabular">{slice.count}</span>
                  <span className="w-9 text-right text-subtle tabular">
                    {total ? Math.round((slice.count / total) * 100) : 0}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

// ---- My tasks ----------------------------------------------------------------------------------

function MyTasksPanel({ className }: { className?: string }) {
  const tasks = useTasks({ status: OPEN_TASK_STATUSES, sort: 'due_date', limit: 8 })
  const drawer = useTaskDrawer()
  const dialogs = useDialogs()
  return (
    <Panel className={className} aria-labelledby="my-tasks-title">
      <PanelHeader
        titleId="my-tasks-title"
        title="My tasks"
        description="Open tasks, soonest deadline first"
        actions={
          <Button asChild variant="link" size="sm">
            <Link to="/tasks?status=open">View all</Link>
          </Button>
        }
      />
      {tasks.isPending ? (
        <RowsSkeleton rows={5} />
      ) : tasks.isError ? (
        <ErrorState compact error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState
          compact
          icon={Inbox}
          title="No open tasks"
          description="You are all caught up. Add the next piece of work when you are ready."
          action={
            <Button size="sm" onClick={() => dialogs.createTask()}>
              Create task
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {tasks.data.items.map((task) => (
            <li key={task.id} className="flex items-center gap-2 px-3 py-2 sm:px-4">
              <TaskStatusMenu task={task} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => drawer.open(task.id)}
                  className="block max-w-full truncate rounded-sm text-left text-[13.5px] text-foreground hover:text-accent-text"
                >
                  {task.title}
                </button>
                <div className="mt-0.5 flex items-center gap-3">
                  <ProjectLink project={task.project} className="text-[12px]" />
                  {task.is_demo ? <DemoBadge /> : null}
                </div>
              </div>
              <PriorityLabel priority={task.priority} className="hidden w-20 sm:inline-flex" />
              <DueDate
                due={task.due_date}
                done={false}
                className="w-28 justify-end"
                showIcon={false}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---- Deadlines -------------------------------------------------------------------------------

function DeadlinesPanel({ className }: { className?: string }) {
  const deadlines = useDeadlines(14, 8)
  const drawer = useTaskDrawer()
  const data = deadlines.data
  return (
    <Panel className={className} aria-labelledby="deadlines-title">
      <PanelHeader
        titleId="deadlines-title"
        title="Upcoming deadlines"
        description="Open tasks due within 14 days, plus overdue"
        actions={
          data && data.overdue_count > 0 ? (
            <Button asChild variant="link" size="sm">
              <Link to="/tasks?due=overdue">View overdue ({data.overdue_count})</Link>
            </Button>
          ) : (
            <Button asChild variant="link" size="sm">
              <Link to="/tasks?due=upcoming&status=open">View upcoming</Link>
            </Button>
          )
        }
      />
      {deadlines.isPending ? (
        <RowsSkeleton rows={5} />
      ) : deadlines.isError ? (
        <ErrorState compact error={deadlines.error} onRetry={() => deadlines.refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          compact
          icon={CircleCheck}
          title="No deadlines in the next two weeks"
          description="Tasks with a deadline show up here as the date approaches."
        />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {data?.items.map((task) => (
            <li key={task.id} className="flex items-center gap-3 px-4 py-2">
              <time
                dateTime={task.due_date ?? undefined}
                className={cn(
                  'flex w-11 shrink-0 flex-col items-center rounded-lg border py-1 leading-none',
                  task.is_overdue
                    ? 'border-danger/40 bg-danger-soft text-danger'
                    : 'border-border bg-surface-2 text-foreground',
                )}
              >
                <span className="text-[10.5px] font-medium opacity-80">
                  {task.due_date ? monthShort(task.due_date) : ''}
                </span>
                <span className="text-[16px] font-semibold font-display tabular">
                  {task.due_date ? dayOfMonth(task.due_date) : ''}
                </span>
              </time>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => drawer.open(task.id)}
                  className="block max-w-full truncate rounded-sm text-left text-[13.5px] text-foreground hover:text-accent-text"
                >
                  {task.title}
                </button>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
                  <ProjectLink project={task.project} className="text-[12px]" />
                  <DueDate
                    due={task.due_date}
                    done={false}
                    showIcon={false}
                    className="text-[12px]"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---- Projects ----------------------------------------------------------------------------------

function ProjectsPanel({ className }: { className?: string }) {
  const projects = useProjects({
    status: ['active', 'planning', 'on_hold'],
    sort: 'due_date',
    limit: 5,
  })
  const dialogs = useDialogs()
  return (
    <Panel className={className} aria-labelledby="projects-title">
      <PanelHeader
        titleId="projects-title"
        title="Projects"
        description="Active, planned and on-hold projects, nearest deadline first"
        actions={
          <Button asChild variant="link" size="sm">
            <Link to="/projects">View all</Link>
          </Button>
        }
      />
      {projects.isPending ? (
        <RowsSkeleton rows={4} />
      ) : projects.isError ? (
        <ErrorState compact error={projects.error} onRetry={() => projects.refetch()} />
      ) : projects.data.items.length === 0 ? (
        <EmptyState
          compact
          icon={FolderKanban}
          title="No active projects"
          description="Create a project to group related tasks and issues."
          action={
            <Button size="sm" onClick={dialogs.createProject}>
              Create project
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {projects.data.items.map((project) => {
            const late = isOverdue(project.due_date, project.status === 'completed')
            return (
              <li key={project.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ProjectDot color={project.color} />
                    <Link
                      to={`/projects/${project.id}`}
                      className="truncate text-[13.5px] font-medium text-foreground hover:text-accent-text"
                    >
                      {project.name}
                    </Link>
                    <ProjectStatusBadge status={project.status} />
                    {project.is_demo ? <DemoBadge /> : null}
                  </div>
                  {project.description ? (
                    <p className="mt-0.5 truncate text-[12.5px] text-subtle">
                      {project.description}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressBar
                      value={project.progress}
                      label={`${project.name} progress`}
                      className="max-w-48"
                    />
                    <span className="text-[12px] whitespace-nowrap text-muted tabular">
                      {project.progress}%{' '}
                      <span className="text-subtle">
                        ({project.completed_task_count}/{project.task_count} tasks)
                      </span>
                    </span>
                  </div>
                </div>
                <div className="hidden flex-col items-end gap-1 sm:flex">
                  {project.due_date ? (
                    <span
                      className={cn(
                        'text-[12px] whitespace-nowrap',
                        late ? 'text-danger' : 'text-muted',
                      )}
                    >
                      {late ? 'Overdue since ' : 'Due '}
                      {formatDay(project.due_date)}
                    </span>
                  ) : (
                    <span className="text-[12px] text-subtle">No deadline</span>
                  )}
                </div>
                <ProjectActionsMenu project={project} />
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ---- Activity --------------------------------------------------------------------------------

function RecentActivityPanel({ className }: { className?: string }) {
  const activity = useActivity({ limit: 7 })
  return (
    <Panel className={className} aria-labelledby="activity-title">
      <PanelHeader
        titleId="activity-title"
        title="Recent activity"
        description="Changes recorded in this workspace"
        actions={
          <Button asChild variant="link" size="sm">
            <Link to="/activity">View all</Link>
          </Button>
        }
      />
      {activity.isPending ? (
        <RowsSkeleton rows={5} />
      ) : activity.isError ? (
        <ErrorState compact error={activity.error} onRetry={() => activity.refetch()} />
      ) : activity.data.items.length === 0 ? (
        <EmptyState
          compact
          icon={History}
          title="No activity yet"
          description="Every project, task and issue change you make is recorded here."
        />
      ) : (
        <ul className="divide-y divide-border border-t border-border px-4">
          {activity.data.items.map((item) => (
            <ActivityItem key={item.id} activity={item} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function DashboardPage() {
  return (
    <PageContainer>
      <DashboardHeader />
      <DemoNotice />
      <KpiStrip />
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <TrendPanel className="lg:col-span-8" />
        <DistributionPanel className="lg:col-span-4" />
        <MyTasksPanel className="lg:col-span-7" />
        <DeadlinesPanel className="lg:col-span-5" />
        <ProjectsPanel className="lg:col-span-7" />
        <RecentActivityPanel className="lg:col-span-5" />
      </div>
    </PageContainer>
  )
}
