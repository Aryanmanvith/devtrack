import { CalendarClock, FolderKanban, FolderPlus, LayoutGrid, List, SearchX } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { DemoBadge, ProjectDot, ProjectStatusBadge } from '@/components/common/entity'
import { FilterSelect } from '@/components/common/filter-select'
import { FilterChips, PageContainer, PageHeader, type ActiveFilter } from '@/components/common/page'
import { SearchField } from '@/components/common/search-field'
import { EmptyState, ErrorState } from '@/components/common/states'
import { ProjectActionsMenu } from '@/components/projects/project-actions'
import { Button } from '@/components/ui/button'
import { Panel, ProgressBar, Segmented, Skeleton } from '@/components/ui/misc'
import { useProjects } from '@/hooks/queries'
import { useUpdateSearchParams } from '@/hooks/use-utils'
import type { Project } from '@/lib/api/types'
import { formatDay, isOverdue } from '@/lib/dates'
import { PROJECT_SORTS, readProjectFilters } from '@/lib/filters'
import { PROJECT_COLOR, PROJECT_STATUS, PROJECT_STATUS_ORDER } from '@/lib/meta'
import { cn, plural } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'

function Deadline({ project }: { project: Project }) {
  if (!project.due_date) return <span className="text-[12px] text-subtle">No deadline</span>
  const late = isOverdue(
    project.due_date,
    project.status === 'completed' || project.status === 'archived',
  )
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[12px] whitespace-nowrap',
        late ? 'text-danger' : 'text-muted',
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      {late ? `Overdue since ${formatDay(project.due_date)}` : `Due ${formatDay(project.due_date)}`}
    </span>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Panel className="group relative flex flex-col p-4 transition-colors hover:border-border-strong">
      <div
        className="absolute inset-x-0 top-0 h-0.5 rounded-t-[14px] opacity-80"
        style={{ background: PROJECT_COLOR[project.color].color }}
        aria-hidden
      />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            {project.is_demo ? <DemoBadge /> : null}
          </div>
          <h2 className="mt-2.5 text-[15px] leading-snug font-semibold text-foreground">
            <Link
              to={`/projects/${project.id}`}
              className="rounded-sm after:absolute after:inset-0 after:rounded-[14px] after:content-[''] hover:text-accent-text"
            >
              {project.name}
            </Link>
          </h2>
        </div>
        <ProjectActionsMenu project={project} />
      </div>
      <p className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[12.5px] leading-relaxed text-muted">
        {project.description || <span className="text-subtle">No description</span>}
      </p>
      <div className="mt-4 flex items-center justify-between text-[12px]">
        <span className="text-muted tabular">
          <span className="font-medium text-foreground">{project.progress}%</span> complete
        </span>
        <span className="text-subtle tabular">
          {project.completed_task_count}/{plural(project.task_count, 'task')}
        </span>
      </div>
      <ProgressBar
        value={project.progress}
        label={`${project.name}: ${project.progress}% of tasks done`}
        className="mt-1.5"
        color={PROJECT_COLOR[project.color].color}
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3">
        <Deadline project={project} />
        <span
          className={cn('text-[12px]', project.overdue_task_count ? 'text-danger' : 'text-subtle')}
        >
          {plural(project.overdue_task_count, 'overdue task')}
        </span>
        <span className="text-[12px] text-subtle">
          {plural(project.open_issue_count, 'open issue')}
        </span>
      </div>
    </Panel>
  )
}

function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <Panel className="relative overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="border-b border-border text-[12px] text-subtle">
          <tr>
            <th scope="col" className="px-4 py-2 font-normal">
              Project
            </th>
            <th scope="col" className="px-3 py-2 font-normal">
              Status
            </th>
            <th scope="col" className="px-3 py-2 font-normal">
              Progress
            </th>
            <th scope="col" className="px-3 py-2 font-normal">
              Deadline
            </th>
            <th scope="col" className="px-3 py-2 font-normal">
              Open issues
            </th>
            <th scope="col" className="px-3 py-2 font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {projects.map((project) => (
            <tr key={project.id} className="transition-colors hover:bg-surface-2/50">
              <td className="max-w-80 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <ProjectDot color={project.color} />
                  <Link
                    to={`/projects/${project.id}`}
                    className="truncate font-medium text-foreground hover:text-accent-text"
                  >
                    {project.name}
                  </Link>
                  {project.is_demo ? <DemoBadge /> : null}
                </div>
                {project.owner ? (
                  <p className="mt-0.5 pl-4 text-[12px] text-subtle">{project.owner}</p>
                ) : null}
              </td>
              <td className="px-3 py-2.5">
                <ProjectStatusBadge status={project.status} />
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <ProgressBar
                    value={project.progress}
                    label={`${project.name} progress`}
                    className="w-24"
                    color={PROJECT_COLOR[project.color].color}
                  />
                  <span className="text-[12px] text-muted tabular">
                    {project.progress}% ({project.completed_task_count}/{project.task_count})
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <Deadline project={project} />
              </td>
              <td className="px-3 py-2.5 text-muted tabular">{project.open_issue_count}</td>
              <td className="px-3 py-2.5 text-right">
                <ProjectActionsMenu project={project} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

export function ProjectsPage() {
  const [params] = useSearchParams()
  const filters = readProjectFilters(params)
  const update = useUpdateSearchParams()
  const dialogs = useDialogs()
  const projects = useProjects({
    q: filters.q || undefined,
    status: filters.status || undefined,
    sort: filters.sort,
    limit: 500,
  })

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
      value: PROJECT_STATUS[filters.status].label,
      onRemove: () => update({ status: null }),
    })
  const clearAll = () => update({ q: null, status: null })

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Group related tasks and issues. Progress is calculated from each project’s tasks."
        actions={
          <Button variant="primary" onClick={dialogs.createProject}>
            <FolderPlus aria-hidden />
            Create project
          </Button>
        }
      />
      <div
        className="mb-3 flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Filter projects"
      >
        <SearchField
          value={filters.q}
          onChange={(q) => update({ q: q || null })}
          label="Search projects"
          placeholder="Search projects"
          className="w-full sm:w-72"
        />
        <FilterSelect
          label="Filter by status"
          value={filters.status}
          onChange={(value) => update({ status: value || null })}
          allLabel="All except archived"
          options={PROJECT_STATUS_ORDER.map((s) => ({ value: s, label: PROJECT_STATUS[s].label }))}
        />
      </div>
      <FilterChips
        filters={active}
        onClearAll={clearAll}
        resultLabel={projects.data ? plural(projects.data.total, 'project') : undefined}
        trailing={
          <>
            <FilterSelect
              label="Sort projects by"
              value={filters.sort}
              onChange={(value) => update({ sort: value === 'updated_at' ? null : value })}
              options={PROJECT_SORTS.map((s) => ({ value: s.value, label: `Sort: ${s.label}` }))}
              className="min-w-40"
              highlight={false}
            />
            <Segmented
              label="Layout"
              value={filters.view}
              onChange={(view) => update({ view: view === 'grid' ? null : view })}
              options={[
                { value: 'grid', label: <LayoutGrid aria-hidden />, title: 'Grid view' },
                { value: 'list', label: <List aria-hidden />, title: 'List view' },
              ]}
            />
          </>
        }
      />
      {projects.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-52 rounded-[14px]" />
          ))}
        </div>
      ) : projects.isError ? (
        <Panel>
          <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
        </Panel>
      ) : projects.data.items.length === 0 ? (
        <Panel>
          {active.length ? (
            <EmptyState
              icon={SearchX}
              title="No projects match these filters"
              description="Archived projects only appear when you filter by Archived."
              action={<Button onClick={clearAll}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="A project collects the tasks and issues for one piece of coursework or product."
              action={
                <Button variant="primary" onClick={dialogs.createProject}>
                  Create project
                </Button>
              }
            />
          )}
        </Panel>
      ) : filters.view === 'list' ? (
        <ProjectTable projects={projects.data.items} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Projects">
          {projects.data.items.map((project) => (
            <li key={project.id} className="flex">
              <div className="flex-1">
                <ProjectCard project={project} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
