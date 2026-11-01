import { ListPlus, SquareKanban } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ProjectDot } from '@/components/common/entity'
import { FilterSelect } from '@/components/common/filter-select'
import { FilterChips, PageContainer, PageHeader, type ActiveFilter } from '@/components/common/page'
import { SearchField } from '@/components/common/search-field'
import { EmptyState, ErrorState } from '@/components/common/states'
import { KanbanBoard } from '@/components/tasks/kanban'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useProject, useProjectOptions, useTasks } from '@/hooks/queries'
import { useUpdateSearchParams } from '@/hooks/use-utils'
import { positiveInt } from '@/lib/filters'
import { plural } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'

export function BoardPage() {
  const [params] = useSearchParams()
  const update = useUpdateSearchParams()
  const projectId = positiveInt(params.get('project'))
  const [query, setQuery] = useState('')
  const dialogs = useDialogs()
  const projects = useProjectOptions()
  const project = useProject(projectId)
  const tasks = useTasks({ project_id: projectId ?? undefined, sort: 'position', limit: 500 })

  const term = query.trim().toLowerCase()
  const visible = (tasks.data?.items ?? []).filter(
    (task) =>
      !term ||
      task.title.toLowerCase().includes(term) ||
      task.labels.some((label) => label.includes(term)),
  )

  const filters: ActiveFilter[] = []
  if (projectId)
    filters.push({
      key: 'project',
      label: 'Project',
      value: project.data?.name ?? `#${projectId}`,
      onRemove: () => update({ project: null }),
    })
  if (term)
    filters.push({
      key: 'q',
      label: 'Cards matching',
      value: `“${query.trim()}”`,
      onRemove: () => setQuery(''),
    })

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title="Kanban Board"
        description="Drag cards between columns, or use a card’s status menu. Every move is saved to the database."
        actions={
          <>
            {projectId ? (
              <Button asChild>
                <Link to={`/projects/${projectId}`}>Open project</Link>
              </Button>
            ) : null}
            <Button
              variant="primary"
              onClick={() => dialogs.createTask({ projectId: projectId ?? undefined })}
            >
              <ListPlus aria-hidden />
              Create task
            </Button>
          </>
        }
      />
      <div
        className="mb-3 flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Filter the board"
      >
        <FilterSelect
          label="Show project"
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
        <SearchField
          value={query}
          onChange={setQuery}
          label="Filter cards"
          placeholder="Filter cards by title or label"
          className="w-full sm:w-72"
          delay={150}
        />
      </div>
      <FilterChips
        filters={filters}
        onClearAll={() => {
          setQuery('')
          update({ project: null })
        }}
        resultLabel={tasks.data ? plural(visible.length, 'card') : undefined}
      />
      {project.isError && projectId ? (
        <ErrorState
          error={project.error}
          title="That project could not be found"
          onRetry={() => update({ project: null })}
        />
      ) : tasks.isPending ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-80 w-[18.5rem] shrink-0 rounded-[14px]" />
          ))}
        </div>
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState
          icon={SquareKanban}
          title={projectId ? 'This project has no tasks yet' : 'The board is empty'}
          description="Create a task and it appears in its status column. Drag it across as work progresses."
          action={
            <Button
              variant="primary"
              onClick={() => dialogs.createTask({ projectId: projectId ?? undefined })}
            >
              Create task
            </Button>
          }
        />
      ) : (
        <KanbanBoard
          tasks={visible}
          onCreate={(status) => dialogs.createTask({ status, projectId: projectId ?? undefined })}
        />
      )}
    </PageContainer>
  )
}
