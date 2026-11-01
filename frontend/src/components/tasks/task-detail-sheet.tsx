import { FileQuestion, Pencil, Trash2, X } from 'lucide-react'
import { VisuallyHidden } from 'radix-ui'
import type { ReactNode } from 'react'
import { ActivityItem } from '@/components/activity/activity-item'
import { DemoBadge, DueDate, LabelChips, ProjectLink } from '@/components/common/entity'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogTitle, SheetContent } from '@/components/ui/dialog'
import { useUpdateTask } from '@/hooks/mutations'
import { useActivity, useTask } from '@/hooks/queries'
import { useTaskDrawer } from '@/hooks/use-drawers'
import { ApiError } from '@/lib/api/client'
import type { Task } from '@/lib/api/types'
import { formatDateTime } from '@/lib/dates'
import { useDialogs } from '@/providers/dialogs'
import { useConfirmDeleteTask } from '@/hooks/use-entity-actions'
import { PriorityMenu, TaskStatusMenu } from './task-controls'

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3 py-1.5">
      <dt className="text-[12.5px] text-subtle">{label}</dt>
      <dd className="min-w-0 text-[13px] text-foreground">{children}</dd>
    </div>
  )
}

export function SheetCloseButton() {
  return (
    <DialogClose asChild>
      <Button variant="ghost" size="icon-sm" aria-label="Close details">
        <X aria-hidden />
      </Button>
    </DialogClose>
  )
}

function TaskDetail({ task }: { task: Task }) {
  const dialogs = useDialogs()
  const update = useUpdateTask()
  const confirmDelete = useConfirmDeleteTask()
  const history = useActivity({ entity_type: 'task', entity_id: task.id, limit: 20 })
  const done = task.status === 'done'

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 pt-4 pb-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ProjectLink project={task.project} />
            {task.is_demo ? <DemoBadge /> : null}
          </div>
          <DialogTitle className="text-[19px] leading-snug font-semibold font-display text-foreground">
            {task.title}
          </DialogTitle>
        </div>
        <SheetCloseButton />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
        <TaskStatusMenu task={task} showLabel />
        <PriorityMenu
          value={task.priority}
          subject={task.title}
          onChange={(priority) =>
            update.mutate({
              id: task.id,
              changes: { priority },
              optimistic: true,
              success: 'Priority updated',
            })
          }
        />
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => dialogs.editTask(task)}>
            <Pencil aria-hidden />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:text-danger"
            onClick={() => confirmDelete(task)}
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <dl>
          <DetailRow label="Deadline">
            <DueDate due={task.due_date} done={done} />
          </DetailRow>
          <DetailRow label="Labels">
            {task.labels.length ? (
              <LabelChips labels={task.labels} max={6} />
            ) : (
              <span className="text-subtle">None</span>
            )}
          </DetailRow>
          <DetailRow label="Created">{formatDateTime(task.created_at)}</DetailRow>
          <DetailRow label="Last updated">{formatDateTime(task.updated_at)}</DetailRow>
          <DetailRow label="Completed">
            {task.completed_at ? (
              formatDateTime(task.completed_at)
            ) : (
              <span className="text-subtle">Not yet</span>
            )}
          </DetailRow>
        </dl>
        <h3 className="mt-6 mb-2 text-[12.5px] font-medium text-subtle">Description</h3>
        {task.description ? (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-foreground">
            {task.description}
          </p>
        ) : (
          <p className="text-[13px] text-subtle">No description yet.</p>
        )}
        <h3 className="mt-6 mb-1 text-[12.5px] font-medium text-subtle">History</h3>
        {history.isPending ? (
          <RowsSkeleton rows={3} className="px-0" />
        ) : history.isError ? (
          <ErrorState compact error={history.error} onRetry={() => history.refetch()} />
        ) : (
          <ul className="divide-y divide-border">
            {history.data.items.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                showProject={false}
                linkEntity={false}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export function TaskDetailSheet() {
  const drawer = useTaskDrawer()
  const query = useTask(drawer.id)
  const notFound = query.error instanceof ApiError && query.error.isNotFound

  return (
    <Dialog open={drawer.id !== null} onOpenChange={(open) => !open && drawer.close()}>
      <SheetContent aria-describedby={undefined}>
        {query.data ? (
          <TaskDetail task={query.data} />
        ) : (
          <>
            <VisuallyHidden.Root>
              <DialogTitle>Task details</DialogTitle>
            </VisuallyHidden.Root>
            <div className="flex justify-end px-4 pt-3">
              <SheetCloseButton />
            </div>
            {notFound ? (
              <EmptyState
                icon={FileQuestion}
                title="This task no longer exists"
                description="It may have been deleted, or the link is out of date."
                action={
                  <Button variant="secondary" onClick={drawer.close}>
                    Close
                  </Button>
                }
              />
            ) : query.isError ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : (
              <RowsSkeleton rows={6} />
            )}
          </>
        )}
      </SheetContent>
    </Dialog>
  )
}
