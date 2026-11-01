import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { History, SearchX } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ActivityItem } from '@/components/activity/activity-item'
import { ProjectDot } from '@/components/common/entity'
import { FilterSelect } from '@/components/common/filter-select'
import { FilterChips, PageContainer, PageHeader, type ActiveFilter } from '@/components/common/page'
import { SearchField } from '@/components/common/search-field'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Panel, Segmented } from '@/components/ui/misc'
import { useActivityFeed, useProjectOptions } from '@/hooks/queries'
import { useUpdateSearchParams } from '@/hooks/use-utils'
import type { Activity, EntityType } from '@/lib/api/types'
import { positiveInt } from '@/lib/filters'
import { plural } from '@/lib/utils'

const TYPES: { value: EntityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'project', label: 'Projects' },
  { value: 'task', label: 'Tasks' },
  { value: 'issue', label: 'Issues' },
  { value: 'system', label: 'System' },
]

function dayLabel(iso: string) {
  const date = parseISO(iso)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMM d, yyyy')
}

function groupByDay(items: Activity[]) {
  const groups: { key: string; label: string; items: Activity[] }[] = []
  for (const item of items) {
    const date = parseISO(item.created_at)
    const key = date.toDateString()
    let group = groups.at(-1)
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(item.created_at), items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

export function ActivityPage() {
  const [params] = useSearchParams()
  const update = useUpdateSearchParams()
  const type = TYPES.find((t) => t.value === params.get('type'))?.value ?? 'all'
  const q = (params.get('q') ?? '').slice(0, 100)
  const project = positiveInt(params.get('project'))
  const projects = useProjectOptions()
  const feed = useActivityFeed({
    entity_type: type === 'all' ? undefined : type,
    q: q || undefined,
    project_id: project ?? undefined,
  })

  const items = feed.data?.pages.flatMap((page) => page.items) ?? []
  const total = feed.data?.pages[0]?.total ?? 0
  const projectName = projects.data?.items.find((p) => p.id === project)?.name
  const active: ActiveFilter[] = []
  if (q)
    active.push({ key: 'q', label: 'Search', value: `“${q}”`, onRemove: () => update({ q: null }) })
  if (project)
    active.push({
      key: 'project',
      label: 'Project',
      value: projectName ?? `#${project}`,
      onRemove: () => update({ project: null }),
    })
  if (type !== 'all')
    active.push({
      key: 'type',
      label: 'Type',
      value: TYPES.find((t) => t.value === type)?.label ?? type,
      onRemove: () => update({ type: null }),
    })
  const clearAll = () => update({ q: null, project: null, type: null })

  return (
    <PageContainer narrow>
      <PageHeader
        title="Activity"
        description="A permanent log of what changed in this workspace, newest first. Entries are written by the API as part of each change."
      />
      <div
        className="mb-3 flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Filter activity"
      >
        <Segmented
          label="Show activity for"
          value={type}
          onChange={(value) => update({ type: value === 'all' ? null : value })}
          options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
        <SearchField
          value={q}
          onChange={(value) => update({ q: value || null })}
          label="Search activity"
          className="w-full sm:w-64"
        />
        <FilterSelect
          label="Filter by project"
          value={project ? String(project) : ''}
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
        resultLabel={feed.data ? plural(total, 'event') : undefined}
      />
      <Panel>
        {feed.isPending ? (
          <RowsSkeleton rows={8} />
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        ) : items.length === 0 ? (
          active.length ? (
            <EmptyState
              icon={SearchX}
              title="No activity matches these filters"
              action={<Button onClick={clearAll}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={History}
              title="No activity yet"
              description="Create a project or task and the change is recorded here."
            />
          )
        ) : (
          <div className="px-5 py-2">
            {groupByDay(items).map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h2 className="sticky top-14 z-10 -mx-5 border-b border-border bg-surface/95 px-5 py-2 text-[12px] font-medium text-subtle backdrop-blur">
                  {group.label}
                </h2>
                <ul className="divide-y divide-border">
                  {group.items.map((item) => (
                    <ActivityItem key={item.id} activity={item} />
                  ))}
                </ul>
              </section>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-border py-3 text-[12.5px] text-subtle">
              <span>
                Showing {items.length} of {total}
              </span>
              {feed.hasNextPage ? (
                <Button
                  size="sm"
                  loading={feed.isFetchingNextPage}
                  onClick={() => feed.fetchNextPage()}
                >
                  Load more
                </Button>
              ) : (
                <span>You have reached the beginning.</span>
              )}
            </div>
          </div>
        )}
      </Panel>
    </PageContainer>
  )
}
