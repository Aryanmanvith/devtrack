import { Command } from 'cmdk'
import { CircleAlert, FolderPlus, ListPlus, LoaderCircle, Search } from 'lucide-react'
import { VisuallyHidden } from 'radix-ui'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { IssueTypeIcon, ProjectDot, TaskStatusIcon } from '@/components/common/entity'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useSearch } from '@/hooks/queries'
import { useIssueDrawer, useTaskDrawer } from '@/hooks/use-drawers'
import { useDebouncedValue } from '@/hooks/use-utils'
import { useDialogs } from '@/providers/dialogs'
import { NAV_ITEMS } from './nav'

const groupClass =
  'px-1.5 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-subtle'
const itemClass =
  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-foreground outline-none data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0'

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 200)
  const search = useSearch(debounced)
  const navigate = useNavigate()
  const dialogs = useDialogs()
  const taskDrawer = useTaskDrawer()
  const issueDrawer = useIssueDrawer()
  const searching = debounced.trim().length >= 2

  const run = (action: () => void) => {
    onOpenChange(false)
    setQuery('')
    action()
  }

  const results = search.data && searching ? search.data : null
  const hasResults = Boolean(
    results && (results.projects.length || results.tasks.length || results.issues.length),
  )

  // cmdk highlights the first item only when it filters the list itself. Search results come
  // from the server instead, so keep the highlight on a current result: the one the user moved
  // to with the arrow keys, otherwise the first. Enter then always opens what is highlighted.
  const [picked, setPicked] = useState('')
  const resultValues = results
    ? [
        ...results.projects.map((project) => `project-${project.id}`),
        ...results.tasks.map((task) => `task-${task.id}`),
        ...results.issues.map((issue) => `issue-${issue.id}`),
      ]
    : null
  const highlighted = resultValues
    ? resultValues.includes(picked)
      ? picked
      : (resultValues[0] ?? '')
    : picked

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="top-[18%] max-w-xl translate-y-0 p-0">
        <VisuallyHidden.Root>
          <DialogTitle>Search DevTrack</DialogTitle>
          <DialogDescription>
            Search projects, tasks and issues, or jump to a page.
          </DialogDescription>
        </VisuallyHidden.Root>
        <Command
          value={highlighted}
          onValueChange={setPicked}
          shouldFilter={!searching}
          label="Search DevTrack"
          className="flex max-h-[60vh] flex-col"
        >
          <div className="flex items-center gap-2 border-b border-border px-4">
            {search.isFetching && searching ? (
              <LoaderCircle className="size-4 shrink-0 animate-spin text-subtle" aria-hidden />
            ) : (
              <Search className="size-4 shrink-0 text-subtle" aria-hidden />
            )}
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search projects, tasks and issues…"
              className="h-12 w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-subtle"
            />
          </div>
          <Command.List className="min-h-0 overflow-y-auto pb-1.5">
            {searching && results && !hasResults ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                No projects, tasks or issues match “{debounced.trim()}”.
              </p>
            ) : null}
            {search.isError && searching ? (
              <p className="px-4 py-8 text-center text-[13px] text-danger">
                Search failed. Check that the API is running.
              </p>
            ) : null}
            {results?.projects.length ? (
              <Command.Group heading="Projects" className={groupClass}>
                {results.projects.map((project) => (
                  <Command.Item
                    key={`p-${project.id}`}
                    value={`project-${project.id}`}
                    onSelect={() => run(() => navigate(`/projects/${project.id}`))}
                    className={itemClass}
                  >
                    <ProjectDot color={project.color} className="size-2.5" />
                    <span className="truncate">{project.name}</span>
                    {project.status === 'archived' ? (
                      <span className="ml-auto text-[12px] text-subtle">Archived</span>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {results?.tasks.length ? (
              <Command.Group heading="Tasks" className={groupClass}>
                {results.tasks.map((task) => (
                  <Command.Item
                    key={`t-${task.id}`}
                    value={`task-${task.id}`}
                    onSelect={() => run(() => taskDrawer.open(task.id))}
                    className={itemClass}
                  >
                    <TaskStatusIcon status={task.status} />
                    <span className="truncate">{task.title}</span>
                    <span className="ml-auto truncate pl-2 text-[12px] text-subtle">
                      {task.project.name}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {results?.issues.length ? (
              <Command.Group heading="Issues" className={groupClass}>
                {results.issues.map((issue) => (
                  <Command.Item
                    key={`i-${issue.id}`}
                    value={`issue-${issue.id}`}
                    onSelect={() => run(() => issueDrawer.open(issue.id))}
                    className={itemClass}
                  >
                    <IssueTypeIcon type={issue.type} />
                    <span className="truncate">{issue.title}</span>
                    <span className="ml-auto truncate pl-2 text-[12px] text-subtle">
                      {issue.project.name}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {!searching ? (
              <>
                <Command.Empty className="px-4 py-8 text-center text-[13px] text-muted">
                  Type at least two characters to search records.
                </Command.Empty>
                <Command.Group heading="Create" className={groupClass}>
                  <Command.Item onSelect={() => run(dialogs.createTask)} className={itemClass}>
                    <ListPlus className="text-subtle" aria-hidden />
                    Create task
                  </Command.Item>
                  <Command.Item onSelect={() => run(dialogs.createProject)} className={itemClass}>
                    <FolderPlus className="text-subtle" aria-hidden />
                    Create project
                  </Command.Item>
                  <Command.Item
                    onSelect={() => run(() => dialogs.createIssue())}
                    className={itemClass}
                  >
                    <CircleAlert className="text-subtle" aria-hidden />
                    Create issue
                  </Command.Item>
                </Command.Group>
                <Command.Group heading="Go to" className={groupClass}>
                  {NAV_ITEMS.map((item) => (
                    <Command.Item
                      key={item.to}
                      onSelect={() => run(() => navigate(item.to))}
                      className={itemClass}
                    >
                      <item.icon className="text-subtle" aria-hidden />
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
