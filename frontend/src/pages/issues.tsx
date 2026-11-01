import { CircleAlert, SearchX } from 'lucide-react'
import { useSearchParams } from 'react-router'
import {
  DemoBadge,
  IssueStatusBadge,
  IssueTypeIcon,
  ProjectDot,
  ProjectLink,
} from '@/components/common/entity'
import { FilterSelect } from '@/components/common/filter-select'
import { FilterChips, PageContainer, PageHeader, type ActiveFilter } from '@/components/common/page'
import { SearchField } from '@/components/common/search-field'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states'
import { IssueActionsMenu } from '@/components/issues/issue-controls'
import { PriorityMenu } from '@/components/tasks/task-controls'
import { Button } from '@/components/ui/button'
import { Panel, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc'
import { useUpdateIssue } from '@/hooks/mutations'
import { useIssues, useIssueSummary, useProjectOptions } from '@/hooks/queries'
import { useIssueDrawer } from '@/hooks/use-drawers'
import { useUpdateSearchParams } from '@/hooks/use-utils'
import type { Issue } from '@/lib/api/types'
import { formatDateTime, relativeTime } from '@/lib/dates'
import { ISSUE_SORTS, readIssueFilters, type IssueState } from '@/lib/filters'
import {
  CLOSED_ISSUE_STATUSES,
  ISSUE_TYPE,
  ISSUE_TYPE_ORDER,
  OPEN_ISSUE_STATUSES,
  PRIORITY,
  PRIORITY_ORDER,
} from '@/lib/meta'
import { cn, plural } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'

function IssueRow({ issue }: { issue: Issue }) {
  const drawer = useIssueDrawer()
  const update = useUpdateIssue()
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2/50 md:grid-cols-[auto_minmax(0,1fr)_7rem_7.5rem_7rem_auto] md:items-center">
      <IssueTypeIcon type={issue.type} className="mt-0.5 md:mt-0" />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => drawer.open(issue.id)}
            className="min-w-0 truncate rounded-sm text-left text-[13.5px] text-foreground hover:text-accent-text"
          >
            {issue.title}
          </button>
          {issue.is_demo ? <DemoBadge /> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-subtle">
          <span>{ISSUE_TYPE[issue.type].label}</span>
          <ProjectLink project={issue.project} className="text-[12px]" />
          <time
            dateTime={issue.created_at}
            title={formatDateTime(issue.created_at)}
            className="md:hidden"
          >
            Opened {relativeTime(issue.created_at)}
          </time>
        </div>
      </div>
      <div className="row-span-2 self-center md:hidden">
        <IssueActionsMenu issue={issue} />
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 md:contents">
        <div>
          <IssueStatusBadge status={issue.status} />
        </div>
        <PriorityMenu
          value={issue.priority}
          subject={issue.title}
          disabled={update.isPending}
          onChange={(priority) =>
            update.mutate({ id: issue.id, changes: { priority }, success: 'Priority updated' })
          }
        />
        <time
          dateTime={issue.created_at}
          title={formatDateTime(issue.created_at)}
          className="hidden text-[12px] text-subtle md:block"
        >
          {relativeTime(issue.created_at)}
        </time>
      </div>
      <div className="hidden md:block">
        <IssueActionsMenu issue={issue} />
      </div>
    </li>
  )
}

export function IssuesPage() {
  const [params] = useSearchParams()
  const filters = readIssueFilters(params)
  const update = useUpdateSearchParams()
  const dialogs = useDialogs()
  const projects = useProjectOptions()
  const summary = useIssueSummary({ project_id: filters.project ?? undefined })
  const statuses =
    filters.state === 'open'
      ? OPEN_ISSUE_STATUSES
      : filters.state === 'closed'
        ? CLOSED_ISSUE_STATUSES
        : undefined
  const issues = useIssues({
    status: statuses,
    q: filters.q || undefined,
    type: filters.type || undefined,
    priority: filters.priority || undefined,
    project_id: filters.project ?? undefined,
    sort: filters.sort,
    limit: 500,
  })

  const projectName = projects.data?.items.find((p) => p.id === filters.project)?.name
  const active: ActiveFilter[] = []
  if (filters.q)
    active.push({
      key: 'q',
      label: 'Search',
      value: `“${filters.q}”`,
      onRemove: () => update({ q: null }),
    })
  if (filters.type)
    active.push({
      key: 'type',
      label: 'Type',
      value: ISSUE_TYPE[filters.type].label,
      onRemove: () => update({ type: null }),
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
  const clearAll = () => update({ q: null, type: null, priority: null, project: null })

  const tabCount = (state: IssueState) =>
    summary.data
      ? state === 'open'
        ? summary.data.open
        : state === 'closed'
          ? summary.data.closed
          : summary.data.total
      : null

  return (
    <PageContainer>
      <PageHeader
        title="Issues"
        description="Bugs, feature requests and questions, tracked per project. Resolve them when they are fixed."
        actions={
          <Button
            variant="primary"
            onClick={() => dialogs.createIssue({ projectId: filters.project ?? undefined })}
          >
            <CircleAlert aria-hidden />
            Create issue
          </Button>
        }
      />
      <Tabs
        value={filters.state}
        onValueChange={(value) => update({ state: value === 'open' ? null : value })}
      >
        <TabsList className="mb-4">
          {(['open', 'closed', 'all'] as const).map((state) => (
            <TabsTrigger key={state} value={state}>
              {state === 'open' ? 'Open' : state === 'closed' ? 'Resolved and closed' : 'All'}
              {tabCount(state) !== null ? (
                <span className="rounded-full bg-surface-2 px-1.5 text-[11.5px] leading-[18px] text-subtle tabular">
                  {tabCount(state)}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div
        className="mb-3 flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Filter issues"
      >
        <SearchField
          value={filters.q}
          onChange={(q) => update({ q: q || null })}
          label="Search issues"
          placeholder="Search titles and descriptions"
          className="w-full sm:w-72"
        />
        <FilterSelect
          label="Filter by type"
          value={filters.type}
          onChange={(value) => update({ type: value || null })}
          allLabel="All types"
          options={ISSUE_TYPE_ORDER.map((t) => ({ value: t, label: ISSUE_TYPE[t].label }))}
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
      </div>
      <FilterChips
        filters={active}
        onClearAll={clearAll}
        resultLabel={issues.data ? plural(issues.data.total, 'issue') : undefined}
        trailing={
          <FilterSelect
            label="Sort issues by"
            value={filters.sort}
            onChange={(value) => update({ sort: value === 'created_at' ? null : value })}
            options={ISSUE_SORTS.map((s) => ({ value: s.value, label: `Sort: ${s.label}` }))}
            className="min-w-40"
            highlight={false}
          />
        }
      />
      <Panel
        className={cn(
          'overflow-hidden',
          issues.isFetching && issues.isPlaceholderData && 'opacity-70 transition-opacity',
        )}
      >
        {issues.isPending ? (
          <RowsSkeleton rows={6} />
        ) : issues.isError ? (
          <ErrorState error={issues.error} onRetry={() => issues.refetch()} />
        ) : issues.data.items.length === 0 ? (
          active.length ? (
            <EmptyState
              icon={SearchX}
              title="No issues match these filters"
              description="Try another search, or clear the filters."
              action={<Button onClick={clearAll}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={CircleAlert}
              title={
                filters.state === 'closed'
                  ? 'No resolved or closed issues yet'
                  : filters.state === 'open'
                    ? 'No open issues'
                    : 'No issues yet'
              }
              description={
                filters.state === 'open'
                  ? 'Nothing is waiting on a fix. Report a bug or request a feature when something comes up.'
                  : 'Issues appear here once they have been reported.'
              }
              action={
                <Button
                  variant="primary"
                  onClick={() => dialogs.createIssue({ projectId: filters.project ?? undefined })}
                >
                  Create issue
                </Button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-border" aria-label="Issues">
            {issues.data.items.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
        )}
      </Panel>
    </PageContainer>
  )
}
