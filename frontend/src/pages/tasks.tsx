import { ArrowDownWideNarrow, ArrowUpNarrowWide, Inbox, ListPlus, SearchX } from 'lucide-react'
import { useSearchParams } from 'react-router'
import {
  DemoBadge,
  DueDate,
  LabelChips,
  PriorityLabel,
  ProjectDot,
  ProjectLink,
} from '@/components/common/entity'
import { FilterSelect } from '@/components/common/filter-select'
import { FilterChips, PageContainer, PageHeader, type ActiveFilter } from '@/components/common/page'
import { SearchField } from '@/components/common/search-field'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states'
import { CompleteToggle, TaskActionsMenu, TaskStatusMenu } from '@/components/tasks/task-controls'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/menu'
import { useLabels, useProjectOptions, useTasks } from '@/hooks/queries'
import { useTaskDrawer } from '@/hooks/use-drawers'
import { useUpdateSearchParams } from '@/hooks/use-utils'
import type { Task } from '@/lib/api/types'
import { rangeLabel } from '@/lib/dates'
import {
  DUE_FILTERS,
  readTaskFilters,
  TASK_FILTER_KEYS,
  TASK_SORTS,
  taskQuery,
} from '@/lib/filters'
import { PRIORITY, PRIORITY_ORDER, TASK_STATUS, TASK_STATUS_ORDER } from '@/lib/meta'
import { cn, plural } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open (not done)' },
  ...TASK_STATUS_ORDER.map((status) => ({ value: status, label: TASK_STATUS[status].label })),
]

function TaskRow({ task }: { task: Task }) {
  const drawer = useTaskDrawer()
  const done = task.status === 'done'
  return (
    <li className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-surface-2/50 md:grid-cols-[auto_minmax(0,1fr)_11rem_9rem_6.5rem_8.5rem_auto]">
      <CompleteToggle task={task} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => drawer.open(task.id)}
            className={cn(
              'min-w-0 truncate rounded-sm text-left text-[13.5px] hover:text-accent-text',
              done ? 'text-subtle line-through decoration-1' : 'text-foreground',
            )}
          >
            {task.title}
          </button>
          {task.is_demo ? <DemoBadge /> : null}
        </div>
        {task.labels.length ? (
          <div className="mt-1">
            <LabelChips labels={task.labels} />
          </div>
        ) : null}
      </div>
      <div className="justify-self-end md:hidden">
        <TaskActionsMenu task={task} />
      </div>
      <div className="col-span-3 col-start-2 flex flex-wrap items-center gap-x-4 gap-y-1 md:contents">
        <ProjectLink project={task.project} className="md:max-w-full" />
        <div>
          <TaskStatusMenu task={task} showLabel className="-ml-2" />
        </div>
        <PriorityLabel priority={task.priority} />
        <DueDate due={task.due_date} done={done} />
      </div>
      <div className="hidden justify-self-end md:block">
        <TaskActionsMenu task={task} />
      </div>
    </li>
  )
}

export function TasksPage() {
  const [params] = useSearchParams()
  const filters = readTaskFilters(params)
  const update = useUpdateSearchParams()
  const dialogs = useDialogs()
  const projects = useProjectOptions()
  const labels = useLabels()
  const tasks = useTasks(taskQuery(filters))

  const projectName = projects.data?.items.find((p) => p.id === filters.project)?.name
  const active: ActiveFilter[] = []
  if (filters.q)
    active.push({
      key: 'q',
      label: 'Search',
      value: `“${filters.q}”`,
      onRemove: () => update({ q: null }),
    })
  if (filters.status)
    active.push({
      key: 'status',
      label: 'Status',
      value: filters.status === 'open' ? 'Open' : TASK_STATUS[filters.status].label,
      onRemove: () => update({ status: null }),
    })
  if (filters.priority)
    active.push({
      key: 'priority',
      label: 'Priority',
      value: PRIORITY[filters.priority].label,
      onRemove: () => update({ priority: null }),
    })
  if (filters.project)
    active.push({
      key: 'project',
      label: 'Project',
      value: projectName ?? `#${filters.project}`,
      onRemove: () => update({ project: null }),
    })
  if (filters.due)
    active.push({
      key: 'due',
      label: 'Deadline',
      value: DUE_FILTERS.find((d) => d.value === filters.due)?.label ?? filters.due,
      onRemove: () => update({ due: null }),
    })
  if (filters.label)
    active.push({
      key: 'label',
      label: 'Label',
      value: filters.label,
      onRemove: () => update({ label: null }),
    })
  if (filters.completedFrom || filters.completedTo)
    active.push({
      key: 'completed',
      label: 'Completed',
      value:
        filters.completedFrom && filters.completedTo
          ? rangeLabel(filters.completedFrom, filters.completedTo)
          : filters.completedFrom
            ? `from ${filters.completedFrom}`
            : `until ${filters.completedTo}`,
      onRemove: () => update({ completed_from: null, completed_to: null }),
    })

  const clearAll = () => update(Object.fromEntries(TASK_FILTER_KEYS.map((key) => [key, null])))
  const defaultOrder = TASK_SORTS.find((s) => s.value === filters.sort)?.defaultOrder ?? 'asc'
  const total = tasks.data?.total ?? 0
  const shown = tasks.data?.items.length ?? 0

  return (
    <PageContainer>
      <PageHeader
        title="My Tasks"
        description="Every task in your local workspace. Search, filter and update them without leaving the list."
        actions={
          <Button
            variant="primary"
            onClick={() => dialogs.createTask({ projectId: filters.project ?? undefined })}
          >
            <ListPlus aria-hidden />
            Create task
          </Button>
        }
      />
      <div
        className="mb-3 flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Filter tasks"
      >
        <SearchField
          value={filters.q}
          onChange={(q) => update({ q: q || null })}
          label="Search tasks"
          placeholder="Search titles and descriptions"
          className="w-full sm:w-72"
        />
        <FilterSelect
          label="Filter by status"
          value={filters.status}
          onChange={(value) => update({ status: value || null })}
          allLabel="All statuses"
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          label="Filter by priority"
          value={filters.priority}
          onChange={(value) => update({ priority: value || null })}
          allLabel="All priorities"
          options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY[p].label }))}
        />
        <FilterSelect
          label="Filter by project"
          value={filters.project ? String(filters.project) : ''}
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
        <FilterSelect
          label="Filter by deadline"
          value={filters.due}
          onChange={(value) => update({ due: value || null })}
          allLabel="Any deadline"
          options={DUE_FILTERS}
        />
        {labels.data && labels.data.length > 0 ? (
          <FilterSelect
            label="Filter by label"
            value={filters.label}
            onChange={(value) => update({ label: value || null })}
            allLabel="All labels"
            options={labels.data.map((l) => ({ value: l.name, label: `${l.name} (${l.count})` }))}
          />
        ) : null}
      </div>

      <FilterChips
        filters={active}
        onClearAll={clearAll}
        resultLabel={
          tasks.data
            ? shown < total
              ? `Showing ${shown} of ${plural(total, 'task')}`
              : plural(total, 'task')
            : undefined
        }
        trailing={
          <>
            <FilterSelect
              label="Sort tasks by"
              value={filters.sort}
              onChange={(value) =>
                update({ sort: value === 'due_date' ? null : value, order: null })
              }
              options={TASK_SORTS.map((s) => ({ value: s.value, label: `Sort: ${s.label}` }))}
              className="min-w-40"
              highlight={false}
            />
            <Tooltip content={filters.order === 'asc' ? 'Ascending' : 'Descending'}>
              <Button
                size="icon-sm"
                aria-label={`Sort ${filters.order === 'asc' ? 'ascending' : 'descending'}. Reverse order`}
                onClick={() => {
                  const next = filters.order === 'asc' ? 'desc' : 'asc'
                  update({ order: next === defaultOrder ? null : next })
                }}
              >
                {filters.order === 'asc' ? (
                  <ArrowUpNarrowWide aria-hidden />
                ) : (
                  <ArrowDownWideNarrow aria-hidden />
                )}
              </Button>
            </Tooltip>
          </>
        }
      />

      <Panel
        className={cn(
          'overflow-hidden',
          tasks.isFetching && tasks.isPlaceholderData && 'opacity-70 transition-opacity',
        )}
      >
        <div className="hidden grid-cols-[auto_minmax(0,1fr)_11rem_9rem_6.5rem_8.5rem_auto] items-center gap-x-3 border-b border-border px-4 py-2 text-[12px] text-subtle md:grid">
          <span className="w-[18px]" aria-hidden />
          <span>Task</span>
          <span>Project</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Deadline</span>
          <span className="w-7" aria-hidden />
        </div>
        {tasks.isPending ? (
          <RowsSkeleton rows={8} />
        ) : tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
        ) : tasks.data.items.length === 0 ? (
          active.length > 0 ? (
            <EmptyState
              icon={SearchX}
              title="No tasks match these filters"
              description="Try removing a filter or searching for something else."
              action={<Button onClick={clearAll}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="No tasks yet"
              description="Break a project into tasks to track what needs doing, who is on it and when it is due."
              action={
                <Button variant="primary" onClick={() => dialogs.createTask()}>
                  Create task
                </Button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-border" aria-label="Tasks">
            {tasks.data.items.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </Panel>
    </PageContainer>
  )
}
