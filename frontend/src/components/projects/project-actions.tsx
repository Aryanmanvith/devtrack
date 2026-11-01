import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  FolderOpen,
  Pencil,
  SquareKanban,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu'
import { useDeleteProject, useUpdateProject } from '@/hooks/mutations'
import type { Project } from '@/lib/api/types'
import { plural } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'

export function ProjectActionsMenu({
  project,
  showOpen = true,
  onDeleted,
  triggerVariant = 'icon',
}: {
  project: Project
  showOpen?: boolean
  onDeleted?: () => void
  triggerVariant?: 'icon' | 'button'
}) {
  const navigate = useNavigate()
  const dialogs = useDialogs()
  const update = useUpdateProject()
  const remove = useDeleteProject()
  const archived = project.status === 'archived'

  const confirmDelete = () => {
    const tasks = project.task_count ? plural(project.task_count, 'task') : 'its tasks'
    dialogs.confirm({
      title: `Delete ${project.name}?`,
      description: (
        <>
          This permanently deletes the project together with {tasks} and all of its issues. The
          activity log keeps a record that it existed. Archive the project instead if you might need
          it again.
        </>
      ),
      confirmLabel: 'Delete project',
      onConfirm: async () => {
        await remove.mutateAsync(project)
        onDeleted?.()
      },
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {triggerVariant === 'icon' ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Actions for ${project.name}`}
            className="relative z-10"
          >
            <Ellipsis aria-hidden />
          </Button>
        ) : (
          <Button aria-label={`More actions for ${project.name}`}>
            <Ellipsis aria-hidden />
            More
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {showOpen ? (
          <DropdownMenuItem onSelect={() => navigate(`/projects/${project.id}`)}>
            <FolderOpen aria-hidden />
            Open project
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => navigate(`/board?project=${project.id}`)}>
          <SquareKanban aria-hidden />
          Open Kanban board
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => dialogs.editProject(project)}>
          <Pencil aria-hidden />
          Edit project
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            update.mutate({
              id: project.id,
              changes: { status: archived ? 'active' : 'archived' },
              success: archived ? 'Project restored' : 'Project archived',
            })
          }
        >
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {archived ? 'Restore project' : 'Archive project'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={confirmDelete}>
          <Trash2 aria-hidden />
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
