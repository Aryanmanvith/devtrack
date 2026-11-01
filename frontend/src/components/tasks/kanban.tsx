import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus } from 'lucide-react'
import {
  useMemo,
  useState,
  type KeyboardEventHandler,
  type PointerEvent,
  type PointerEventHandler,
  type ReactNode,
} from 'react'
import {
  DemoBadge,
  DueDate,
  LabelChips,
  PriorityLabel,
  ProjectDot,
  TaskStatusIcon,
} from '@/components/common/entity'
import { Button } from '@/components/ui/button'
import { useUpdateTask } from '@/hooks/mutations'
import { useTaskDrawer } from '@/hooks/use-drawers'
import type { Task, TaskStatus } from '@/lib/api/types'
import { TASK_STATUS, TASK_STATUS_ORDER } from '@/lib/meta'
import { positionBetween } from '@/lib/kanban'
import { cn } from '@/lib/utils'
import { TaskActionsMenu, TaskStatusMenu } from './task-controls'

type Columns = Record<TaskStatus, Task[]>
const COLUMN_PREFIX = 'column:'

function groupByStatus(tasks: Task[]): Columns {
  const columns = Object.fromEntries(
    TASK_STATUS_ORDER.map((status) => [status, [] as Task[]]),
  ) as Columns
  for (const task of tasks) columns[task.status].push(task)
  for (const status of TASK_STATUS_ORDER)
    columns[status].sort((a, b) => a.position - b.position || a.id - b.id)
  return columns
}

function columnOf(id: UniqueIdentifier, columns: Columns): TaskStatus | null {
  const key = String(id)
  if (key.startsWith(COLUMN_PREFIX)) return key.slice(COLUMN_PREFIX.length) as TaskStatus
  return (
    TASK_STATUS_ORDER.find((status) => columns[status].some((task) => task.id === Number(id))) ??
    null
  )
}

const stopDrag = { onPointerDown: (event: PointerEvent) => event.stopPropagation() }

function CardBody({ task, handle }: { task: Task; handle?: ReactNode }) {
  const drawer = useTaskDrawer()
  return (
    <>
      <div className="flex items-start gap-1.5">
        {handle}
        <button
          type="button"
          {...stopDrag}
          onClick={() => drawer.open(task.id)}
          className="min-w-0 flex-1 rounded-sm text-left text-[13px] leading-snug font-medium text-foreground hover:text-accent-text"
        >
          <span className="line-clamp-2">{task.title}</span>
        </button>
        <div {...stopDrag}>
          <TaskActionsMenu task={task} />
        </div>
      </div>
      {task.labels.length ? (
        <div className="mt-2 pl-6">
          <LabelChips labels={task.labels} max={2} />
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center gap-2 pl-6">
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-muted">
          <ProjectDot color={task.project.color} />
          <span className="truncate">{task.project.name}</span>
        </span>
        {task.is_demo ? <DemoBadge /> : null}
      </div>
      <div className="mt-2 flex items-center gap-2 pl-6">
        <div {...stopDrag}>
          <TaskStatusMenu task={task} className="-ml-1.5" />
        </div>
        <PriorityLabel priority={task.priority} compact />
        <DueDate
          due={task.due_date}
          done={task.status === 'done'}
          className="ml-auto text-[12px]"
        />
      </div>
    </>
  )
}

const cardClass =
  'rounded-xl border border-border bg-surface p-2.5 shadow-panel transition-[border-color,box-shadow] hover:border-border-strong'

function SortableCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
  })
  // dnd-kit types its listener map loosely; pointer drags start anywhere on the card,
  // keyboard drags only from the handle so Enter on the title still opens the task.
  const onPointerDown = listeners?.onPointerDown as PointerEventHandler<HTMLDivElement> | undefined
  const onHandleKeyDown = listeners?.onKeyDown as
    KeyboardEventHandler<HTMLButtonElement> | undefined
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onPointerDown={onPointerDown}
      className={cn(
        cardClass,
        'relative shrink-0 cursor-grab touch-manipulation active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
      data-testid={`kanban-card-${task.id}`}
    >
      <CardBody
        task={task}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            onKeyDown={onHandleKeyDown}
            aria-label={`Move task ${task.title}`}
            className="mt-px -ml-1 flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-subtle hover:bg-surface-2 hover:text-foreground"
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        }
      />
    </div>
  )
}

function Column({
  status,
  tasks,
  onCreate,
}: {
  status: TaskStatus
  tasks: Task[]
  onCreate: (status: TaskStatus) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${status}` })
  const meta = TASK_STATUS[status]
  const titleId = `column-${status}-title`
  return (
    <section
      aria-labelledby={titleId}
      className="flex max-h-full min-h-0 w-[18.5rem] shrink-0 snap-start flex-col rounded-[14px] border border-border bg-[color-mix(in_oklab,var(--surface)_45%,var(--background))]"
      data-testid={`kanban-column-${status}`}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <TaskStatusIcon status={status} />
        <h2 id={titleId} className="text-[13px] font-semibold text-foreground">
          {meta.label}
        </h2>
        <span
          className="rounded-full bg-surface-2 px-1.5 text-[11.5px] leading-[18px] text-subtle tabular"
          aria-label={`${tasks.length} tasks`}
        >
          {tasks.length}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          aria-label={`Create task in ${meta.label}`}
          onClick={() => onCreate(status)}
        >
          <Plus aria-hidden />
        </Button>
      </header>
      <SortableContext
        id={status}
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            'relative flex min-h-28 flex-1 flex-col gap-2 overflow-y-auto rounded-b-[14px] p-2 transition-colors',
            isOver && 'bg-primary-soft',
          )}
        >
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} />
          ))}
          {tasks.length === 0 ? (
            <p className="m-auto px-4 py-6 text-center text-[12px] text-subtle">
              No tasks. Drag a card here or use a card’s status menu.
            </p>
          ) : null}
        </div>
      </SortableContext>
    </section>
  )
}

export function KanbanBoard({
  tasks,
  onCreate,
}: {
  tasks: Task[]
  onCreate: (status: TaskStatus) => void
}) {
  const update = useUpdateTask()
  const serverColumns = useMemo(() => groupByStatus(tasks), [tasks])
  // While dragging (and until the optimistic cache update lands) the board renders this copy.
  const [draft, setDraft] = useState<Columns | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const columns = draft ?? serverColumns
  const activeTask = activeId !== null ? tasks.find((task) => task.id === activeId) : undefined

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const titleOf = (id: UniqueIdentifier) =>
    tasks.find((task) => task.id === Number(id))?.title ?? 'task'
  const placeOf = (id: UniqueIdentifier | undefined) => {
    if (id === undefined) return 'nowhere'
    const status = columnOf(id, columns)
    return status ? TASK_STATUS[status].label : 'the board'
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up task ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) => `Task ${titleOf(active.id)} is over ${placeOf(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Task ${titleOf(active.id)} was dropped in ${placeOf(over.id)}.`
        : `Task ${titleOf(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving cancelled. Task ${titleOf(active.id)} was not moved.`,
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(Number(active.id))
    setDraft(serverColumns)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    setDraft((current) => {
      const board = current ?? serverColumns
      const from = columnOf(active.id, board)
      const to = columnOf(over.id, board)
      if (!from || !to || from === to) return board
      const moving = board[from].find((task) => task.id === Number(active.id))
      if (!moving) return board
      const target = board[to]
      const overIndex = target.findIndex((task) => task.id === Number(over.id))
      const insertAt = overIndex >= 0 ? overIndex : target.length
      return {
        ...board,
        [from]: board[from].filter((task) => task.id !== moving.id),
        [to]: [...target.slice(0, insertAt), { ...moving, status: to }, ...target.slice(insertAt)],
      }
    })
  }

  const finish = () => {
    setActiveId(null)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    finish()
    const board = draft ?? serverColumns
    const original = tasks.find((task) => task.id === Number(active.id))
    const status = columnOf(active.id, board)
    if (!over || !original || !status) {
      setDraft(null)
      return
    }
    let items = board[status]
    const overStatus = columnOf(over.id, board)
    if (overStatus === status && !String(over.id).startsWith(COLUMN_PREFIX)) {
      const from = items.findIndex((task) => task.id === original.id)
      const to = items.findIndex((task) => task.id === Number(over.id))
      if (from !== to && from >= 0 && to >= 0) items = arrayMove(items, from, to)
    }
    const index = items.findIndex((task) => task.id === original.id)
    const originalColumn = serverColumns[original.status]
    const unchanged =
      status === original.status &&
      index === originalColumn.findIndex((task) => task.id === original.id)
    if (unchanged || index < 0) {
      setDraft(null)
      return
    }
    const position = positionBetween(items[index - 1]?.position, items[index + 1]?.position)
    const statusChanged = status !== original.status
    setDraft({ ...board, [status]: items })
    update.mutate(
      {
        id: original.id,
        changes: statusChanged ? { status, position } : { position },
        optimistic: true,
        success: statusChanged
          ? status === 'done'
            ? 'Task completed'
            : `Moved to ${TASK_STATUS[status].label}`
          : false,
        failure: 'Could not move the task',
        onOptimistic: () => setDraft(null),
      },
      { onSettled: () => setDraft(null) },
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      // The default zone (20% of the board's width) starts scrolling while the pointer is
      // still over a visible column near the edge, so the card lands one column too far.
      autoScroll={{ threshold: { x: 0.08, y: 0.15 } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        finish()
        setDraft(null)
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To move a task, press Space or Enter on its handle, use the arrow keys to choose a new position or column, then press Space or Enter again to drop it. Press Escape to cancel. You can also change the status from the card’s status menu.',
        },
      }}
    >
      <div
        className="relative -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:h-[max(26rem,calc(100dvh-17.5rem))] lg:-mx-8 lg:scroll-px-8 lg:px-8"
        data-testid="kanban-board"
      >
        {TASK_STATUS_ORDER.map((status) => (
          <Column key={status} status={status} tasks={columns[status]} onCreate={onCreate} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeTask ? (
          <div
            className={cn(
              cardClass,
              'w-[17.25rem] rotate-[1.5deg] cursor-grabbing border-border-strong shadow-pop',
            )}
          >
            <CardBody
              task={activeTask}
              handle={
                <span className="mt-px -ml-1 flex size-5 shrink-0 items-center justify-center text-subtle">
                  <GripVertical className="size-3.5" aria-hidden />
                </span>
              }
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
