import { addDays, format, parseISO } from 'date-fns'
import { ChartColumn } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CompletionTrendChart, SeriesToggles } from '@/components/charts/charts'
import type { TrendSeries } from '@/components/charts/series'
import { ProjectDot } from '@/components/common/entity'
import { FilterSelect } from '@/components/common/filter-select'
import { FilterChips, PageContainer, PageHeader, type ActiveFilter } from '@/components/common/page'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Panel, PanelHeader, Segmented, Skeleton } from '@/components/ui/misc'
import { useAnalytics, useProjectOptions } from '@/hooks/queries'
import { useUpdateSearchParams } from '@/hooks/use-utils'
import type { AnalyticsOverview } from '@/lib/api/types'
import { formatDayLong, rangeLabel, todayIso } from '@/lib/dates'
import { positiveInt } from '@/lib/filters'
import { ISSUE_TYPE, PRIORITY, PROJECT_COLOR, TASK_STATUS } from '@/lib/meta'
import { cn, plural } from '@/lib/utils'

const RANGES = ['4', '8', '12', '26'] as const
type Range = (typeof RANGES)[number]

function withProject(path: string, projectId: number | null) {
  if (!projectId) return path
  return `${path}${path.includes('?') ? '&' : '?'}project=${projectId}`
}

function Stat({
  label,
  value,
  note,
  to,
  tone,
}: {
  label: string
  value: ReactNode
  note: string
  to?: string
  tone?: 'danger'
}) {
  const body = (
    <>
      <span className="text-[12.5px] text-muted">{label}</span>
      <span
        className={cn(
          'text-[28px] leading-tight font-semibold font-display tabular',
          tone === 'danger' ? 'text-danger' : 'text-foreground',
        )}
      >
        {value}
      </span>
      <span className="text-[12px] text-subtle">{note}</span>
    </>
  )
  return to ? (
    <Link
      to={to}
      className="flex flex-col gap-1 rounded-[14px] border border-border bg-surface p-4 shadow-panel transition-colors hover:border-border-strong hover:bg-surface-2/50"
    >
      {body}
    </Link>
  ) : (
    <div className="flex flex-col gap-1 rounded-[14px] border border-border bg-surface p-4 shadow-panel">
      {body}
    </div>
  )
}

/** Horizontal bars rendered as links, so every bar is keyboard reachable. */
function BreakdownList({
  rows,
  total,
  emptyText,
  labelWidth = '8.5rem',
}: {
  rows: {
    key: string
    label: ReactNode
    title?: string
    hint?: string
    count: number
    color: string
    to: string
    suffix?: string
  }[]
  total: number
  emptyText: string
  labelWidth?: string
}) {
  if (total === 0) return <p className="px-5 pb-5 text-[13px] text-subtle">{emptyText}</p>
  const max = Math.max(...rows.map((row) => row.count), 1)
  return (
    <ul className="flex flex-col gap-1 px-3 pb-4">
      {rows.map((row) => (
        <li key={row.key}>
          <Link
            to={row.to}
            style={{ gridTemplateColumns: `minmax(0, ${labelWidth}) 1fr 2.75rem` }}
            title={row.title}
            className="grid items-center gap-3 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-muted">{row.label}</span>
              {row.hint ? (
                <span className="block truncate text-[11.5px] text-subtle">{row.hint}</span>
              ) : null}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--border)_80%,transparent)]">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(row.count / max) * 100}%`, background: row.color }}
              />
            </span>
            <span className="text-right font-medium text-foreground tabular">
              {row.count}
              {row.suffix ?? ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function heat(count: number) {
  if (count === 0) return 'var(--grid)'
  const strength = count >= 5 ? 100 : count >= 3 ? 78 : count === 2 ? 56 : 36
  return `color-mix(in oklab, var(--primary) ${strength}%, var(--surface))`
}

/** One column per week, one row per weekday; each day with completions links to them. */
function CompletionCalendar({
  data,
  projectId,
}: {
  data: AnalyticsOverview
  projectId: number | null
}) {
  const today = todayIso()
  const weeks: { date: string; count: number }[][] = []
  data.daily_completions.forEach((day, index) => {
    if (index % 7 === 0) weeks.push([])
    weeks.at(-1)?.push(day)
  })
  const start = parseISO(data.range_start)
  const weekdays = Array.from({ length: 7 }, (_, index) => format(addDays(start, index), 'EEE'))
  const past = data.daily_completions.filter((day) => day.date <= today)
  const activeDays = past.filter((day) => day.count > 0).length
  const busiest = past.reduce<{ date: string; count: number } | null>(
    (best, day) => (day.count > (best?.count ?? 0) ? day : best),
    null,
  )
  const byWeekday = weekdays.map((name, index) => ({
    name,
    total: data.daily_completions
      .filter((_, i) => i % 7 === index)
      .reduce((sum, day) => sum + day.count, 0),
  }))
  const bestWeekday = byWeekday.reduce(
    (best, day) => (day.total > best.total ? day : best),
    byWeekday[0]!,
  )
  let streak = 0
  for (let i = past.length - 1; i >= 0; i -= 1) {
    const day = past[i]!
    if (day.count > 0) streak += 1
    else if (day.date === today && streak === 0) continue
    else break
  }
  const facts = [
    { label: 'Days with completions', value: `${activeDays} of ${past.length}` },
    {
      label: 'Busiest day',
      value: busiest ? `${formatDayLong(busiest.date)} (${busiest.count})` : 'None yet',
    },
    {
      label: 'Most productive weekday',
      value: bestWeekday.total ? `${bestWeekday.name} (${bestWeekday.total})` : 'None yet',
    },
    { label: 'Current streak', value: plural(streak, 'day') },
  ]
  return (
    <div className="flex flex-col gap-6 px-5 pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="relative min-w-0 overflow-x-auto">
        <div className="flex gap-1.5">
          <div
            className="flex flex-col gap-1 pt-0.5 pr-1 text-[10.5px] leading-[14px] text-subtle"
            aria-hidden
          >
            {weekdays.map((day, index) => (
              <span key={day} className={cn('h-3.5', index % 2 === 1 && 'invisible')}>
                {day}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]?.date} className="flex flex-col gap-1">
              {week.map((day) => {
                const future = day.date > today
                const label = `${formatDayLong(day.date)}: ${plural(day.count, 'task')} completed`
                const cell = (
                  <span
                    className={cn('block size-3.5 rounded-[3px]', future && 'opacity-30')}
                    style={{ background: heat(day.count) }}
                  />
                )
                return day.count > 0 ? (
                  <Link
                    key={day.date}
                    to={withProject(
                      `/tasks?status=done&completed_from=${day.date}&completed_to=${day.date}`,
                      projectId,
                    )}
                    aria-label={`${label}. View them`}
                    title={label}
                    className="rounded-[3px] hover:outline-2 hover:outline-offset-1 hover:outline-ring"
                  >
                    {cell}
                  </Link>
                ) : (
                  <span
                    key={day.date}
                    title={future ? `${formatDayLong(day.date)} (upcoming)` : label}
                    role="img"
                    aria-label={future ? `${formatDayLong(day.date)}: upcoming` : label}
                  >
                    {cell}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-subtle" aria-hidden>
          Fewer
          {[0, 1, 2, 3, 5].map((count) => (
            <span
              key={count}
              className="size-3 rounded-[3px]"
              style={{ background: heat(count) }}
            />
          ))}
          More
        </div>
      </div>
      <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-3 lg:w-[22rem]">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-[12px] text-subtle">{fact.label}</dt>
            <dd className="mt-0.5 text-[13px] font-medium text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function AnalyticsPage() {
  const [params] = useSearchParams()
  const update = useUpdateSearchParams()
  const navigate = useNavigate()
  const projects = useProjectOptions()
  const projectId = positiveInt(params.get('project'))
  const weeks: Range = RANGES.find((r) => r === params.get('weeks')) ?? '12'
  const analytics = useAnalytics({ weeks: Number(weeks), project_id: projectId ?? undefined })
  const [hidden, setHidden] = useState<ReadonlySet<TrendSeries>>(new Set())
  const data = analytics.data

  const projectName = projects.data?.items.find((p) => p.id === projectId)?.name
  const filters: ActiveFilter[] = []
  if (projectId)
    filters.push({
      key: 'project',
      label: 'Project',
      value: projectName ?? `#${projectId}`,
      onRemove: () => update({ project: null }),
    })

  const toggle = (series: TrendSeries) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(series)) next.delete(series)
      else next.add(series)
      return next
    })

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="How work is flowing, calculated from the same task and issue records as the rest of DevTrack."
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Analyse project"
          value={projectId ? String(projectId) : ''}
          onChange={(value) => update({ project: value || null })}
          allLabel="All projects"
          options={(projects.data?.items ?? []).map((p) => ({
            value: String(p.id),
            label: (
              <>
                <ProjectDot color={p.color} />
                {p.name}
              </>
            ),
          }))}
        />
        <Segmented
          label="Date range"
          value={weeks}
          onChange={(value) => update({ weeks: value === '12' ? null : value })}
          options={RANGES.map((r) => ({ value: r, label: `${r} weeks`, title: `Last ${r} weeks` }))}
        />
        {data ? (
          <span className="text-[12.5px] text-subtle sm:ml-auto">
            {rangeLabel(data.range_start, data.range_end)},{' '}
            {format(parseISO(data.range_end), 'yyyy')}
          </span>
        ) : null}
      </div>
      <FilterChips filters={filters} onClearAll={() => update({ project: null })} />

      {analytics.isPending ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-[14px]" />
          ))}
        </div>
      ) : analytics.isError ? (
        <Panel>
          <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
        </Panel>
      ) : data && data.total_tasks === 0 && data.open_issues === 0 ? (
        <Panel>
          <EmptyState
            icon={ChartColumn}
            title={projectId ? 'Nothing to analyse in this project yet' : 'Nothing to analyse yet'}
            description="Charts appear once there are tasks. Every number on this page is calculated from your records."
          />
        </Panel>
      ) : data ? (
        <div
          className={cn(
            'flex flex-col gap-5',
            analytics.isFetching && analytics.isPlaceholderData && 'opacity-70 transition-opacity',
          )}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label="Completion rate"
              value={`${data.completion_rate}%`}
              note={`${data.completed_tasks} of ${plural(data.total_tasks, 'task')} done`}
              to={withProject('/tasks?status=done', projectId)}
            />
            <Stat
              label="Open tasks"
              value={data.open_tasks}
              note="Not done yet"
              to={withProject('/tasks?status=open', projectId)}
            />
            <Stat
              label="Overdue tasks"
              value={data.overdue_tasks}
              note="Past their deadline"
              tone={data.overdue_tasks ? 'danger' : undefined}
              to={withProject('/tasks?due=overdue', projectId)}
            />
            <Stat
              label="Open issues"
              value={data.open_issues}
              note="Open or in progress"
              to={withProject('/issues?state=open', projectId)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label={`Completed in ${weeks} weeks`}
              value={data.completed_in_range}
              note={rangeLabel(data.range_start, data.range_end)}
              to={withProject(
                `/tasks?status=done&completed_from=${data.range_start}&completed_to=${data.range_end}`,
                projectId,
              )}
            />
            <Stat
              label={`Created in ${weeks} weeks`}
              value={data.created_in_range}
              note="New tasks added"
            />
            <Stat
              label="Average cycle time"
              value={data.avg_cycle_days === null ? 'No data' : `${data.avg_cycle_days} d`}
              note="Creation to completion, in range"
            />
            <Stat
              label={`Issues resolved in ${weeks} weeks`}
              value={data.resolved_issues_in_range}
              note="Resolved or closed"
              to={withProject('/issues?state=closed', projectId)}
            />
          </div>

          <Panel aria-labelledby="weekly-title">
            <PanelHeader
              titleId="weekly-title"
              title="Weekly completion trend"
              description="Click a bar to open the tasks completed that week"
              actions={
                <SeriesToggles
                  series={['completed', 'created', 'remaining']}
                  hidden={hidden}
                  onToggle={toggle}
                />
              }
            />
            <figure
              className="px-3 pb-4"
              aria-label={`Weekly completion trend for the last ${weeks} weeks`}
            >
              <CompletionTrendChart
                points={data.weekly}
                selectedIndex={-1}
                hidden={hidden}
                showCreated
                height={260}
                onSelect={(index) => {
                  const point = data.weekly[index]
                  if (point)
                    navigate(
                      withProject(
                        `/tasks?status=done&completed_from=${point.week_start}&completed_to=${point.week_end}`,
                        projectId,
                      ),
                    )
                }}
              />
            </figure>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel aria-labelledby="status-title">
              <PanelHeader
                titleId="status-title"
                title="Tasks by status"
                description="All tasks, current state"
              />
              <BreakdownList
                total={data.total_tasks}
                emptyText="No tasks yet."
                rows={data.by_status.map((item) => {
                  const status = item.key as keyof typeof TASK_STATUS
                  return {
                    key: item.key,
                    label: TASK_STATUS[status].label,
                    count: item.count,
                    color: TASK_STATUS[status].color,
                    to: withProject(`/tasks?status=${item.key}`, projectId),
                  }
                })}
              />
            </Panel>
            <Panel aria-labelledby="priority-title">
              <PanelHeader
                titleId="priority-title"
                title="Open tasks by priority"
                description="What is left, by urgency"
              />
              <BreakdownList
                total={data.open_tasks}
                emptyText="No open tasks."
                rows={data.by_priority.map((item) => {
                  const priority = item.key as keyof typeof PRIORITY
                  return {
                    key: item.key,
                    label: PRIORITY[priority].label,
                    count: item.count,
                    color: PRIORITY[priority].color,
                    to: withProject(`/tasks?status=open&priority=${item.key}`, projectId),
                  }
                })}
              />
            </Panel>
            <Panel aria-labelledby="progress-title">
              <PanelHeader
                titleId="progress-title"
                title="Project progress"
                description="Share of each project’s tasks that are done"
              />
              <BreakdownList
                total={data.project_progress.length}
                emptyText="No projects to compare."
                labelWidth="13rem"
                rows={data.project_progress.map((item) => ({
                  key: String(item.project.id),
                  title: item.project.name,
                  hint: `${item.done} of ${plural(item.total, 'task')} done`,
                  label: (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ProjectDot color={item.project.color} />
                      <span className="truncate">{item.project.name}</span>
                    </span>
                  ),
                  count: item.progress,
                  suffix: '%',
                  color: PROJECT_COLOR[item.project.color].color,
                  to: `/projects/${item.project.id}`,
                }))}
              />
            </Panel>
            <Panel aria-labelledby="issues-title">
              <PanelHeader
                titleId="issues-title"
                title="Issues by type"
                description="Open issues by type, with resolved and closed counts underneath"
              />
              <BreakdownList
                total={data.issues_by_type.reduce((sum, item) => sum + item.open + item.closed, 0)}
                emptyText="No issues yet."
                rows={data.issues_by_type.map((item) => ({
                  key: item.type,
                  label: ISSUE_TYPE[item.type].label,
                  hint: `${item.closed} resolved or closed`,
                  count: item.open,
                  color: ISSUE_TYPE[item.type].color,
                  to: withProject(`/issues?state=all&type=${item.type}`, projectId),
                }))}
              />
            </Panel>
          </div>

          <Panel aria-labelledby="calendar-title">
            <PanelHeader
              titleId="calendar-title"
              title="Completion calendar"
              description="Tasks completed each day; select a day to see them"
            />
            <CompletionCalendar data={data} projectId={projectId} />
          </Panel>
        </div>
      ) : null}
    </PageContainer>
  )
}
