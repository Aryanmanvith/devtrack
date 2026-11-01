import { Check, ChevronDown, Ellipsis, PanelRightOpen, Pencil, Trash2 } from 'lucide-react'
import { TaskStatusIcon } from '@/components/common/entity'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu'
import { useUpdateTask } from '@/hooks/mutations'
import { useConfirmDeleteTask } from '@/hooks/use-entity-actions'
import { useTaskDrawer } from '@/hooks/use-drawers'
import type { Priority, Task, TaskStatus } from '@/lib/api/types'
import { PRIORITY, PRIORITY_ORDER, TASK_STATUS, TASK_STATUS_ORDER } from '@/lib/meta'
import { cn } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'

function statusSuccess(status: TaskStatus) {
  return status === 'done' ? 'Task completed' : `Moved to ${TASK_STATUS[status].label}`
}

/** Change a task's status from a menu: the keyboard-accessible alternative to dragging. */
export function TaskStatusMenu({
  task,
  showLabel = false,
  align = 'start',
  className,
}: {
  task: Task
  showLabel?: boolean
  align?: 'start' | 'end'
  className?: string
}) {
  const update = useUpdateTask()
  const label = TASK_STATUS[task.status].label
  const change = (value: string) => {
    const status = value as TaskStatus
    if (status === task.status) return
    update.mutate({
      id: task.id,
      changes: { status },
      optimistic: true,
      success: statusSuccess(status),
      failure: 'Could not change the status',
    })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Status: ${label}. Change status of ${task.title}`}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md text-[12.5px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground data-[state=open]:bg-surface-2',
            showLabel ? 'h-7 px-2' : 'size-7 justify-center',
            className,
          )}
        >
          <TaskStatusIcon status={task.status} />
          {showLabel ? (
            <>
              <span className="whitespace-nowrap">{label}</span>
              <ChevronDown className="size-3.5 text-subtle" aria-hidden />
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={task.status} onValueChange={change}>
          {TASK_STATUS_ORDER.map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              <TaskStatusIcon status={status} />
              {TASK_STATUS[status].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** One-click completion toggle used in task lists. */
export function CompleteToggle({ task }: { task: Task }) {
  const update = useUpdateTask()
  const done = task.status === 'done'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
      onClick={(event) => {
        event.stopPropagation()
        update.mutate({
          id: task.id,
          changes: { status: done ? 'todo' : 'done' },
          optimistic: true,
          success: done ? 'Task reopened' : 'Task completed',
          failure: 'Could not update the task',
        })
      }}
      className={cn(
        'flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
        done
          ? 'border-status-done bg-status-done text-white dark:text-[#17181c]'
          : 'border-border-strong hover:border-status-done hover:bg-[color-mix(in_oklab,var(--status-done)_14%,transparent)]',
      )}
    >
      {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
    </button>
  )
}

export function PriorityMenu({
  value,
  onChange,
  subject,
  disabled,
}: {
  value: Priority
  onChange: (priority: Priority) => void
  subject: string
  disabled?: boolean
}) {
  const meta = PRIORITY[value]
  const Icon = meta.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`Priority: ${meta.label}. Change priority of ${subject}`}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground data-[state=open]:bg-surface-2"
        >
          <Icon className={cn('size-3.5', meta.text)} aria-hidden />
          <span>{meta.label}</span>
          <ChevronDown className="size-3.5 text-subtle" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>Priority</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => next !== value && onChange(next as Priority)}
        >
          {PRIORITY_ORDER.map((priority) => {
            const ItemIcon = PRIORITY[priority].icon
            return (
              <DropdownMenuRadioItem key={priority} value={priority}>
                <ItemIcon className={PRIORITY[priority].text} />
                {PRIORITY[priority].label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TaskActionsMenu({ task, align = 'end' }: { task: Task; align?: 'start' | 'end' }) {
  const dialogs = useDialogs()
  const drawer = useTaskDrawer()
  const confirmDelete = useConfirmDeleteTask()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`More actions for ${task.title}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem onSelect={() => drawer.open(task.id)}>
          <PanelRightOpen aria-hidden />
          Open details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => dialogs.editTask(task)}>
          <Pencil aria-hidden />
          Edit task
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => confirmDelete(task)}>
          <Trash2 aria-hidden />
          Delete task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
