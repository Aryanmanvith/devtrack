import { Bell, CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DueDate, ProjectDot } from '@/components/common/entity'
import { ErrorState, RowsSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { useDeadlines } from '@/hooks/queries'
import { useTaskDrawer } from '@/hooks/use-drawers'

/**
 * Deadline alerts: tasks that are overdue or due today, calculated from real task records.
 * This is the only notification source in DevTrack, so the bell never shows invented counts.
 */
export function DeadlineAlerts() {
  const [open, setOpen] = useState(false)
  const query = useDeadlines(0, 20)
  const drawer = useTaskDrawer()
  const count = query.data ? query.data.overdue_count + query.data.upcoming_count : 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={
            count
              ? `Deadline alerts: ${count} task${count === 1 ? '' : 's'} need attention`
              : 'Deadline alerts: nothing due today'
          }
        >
          <Bell aria-hidden />
          {count ? (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white tabular dark:text-[#17181c]">
              {count > 9 ? '9+' : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-1.5rem))]" aria-label="Deadline alerts">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[13.5px] font-semibold text-foreground">Needs attention</p>
          <p className="text-[12px] text-subtle">Open tasks that are overdue or due today</p>
        </div>
        {query.isPending ? (
          <RowsSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState compact error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <CalendarCheck className="size-5 text-status-done" aria-hidden />
            <p className="text-[13px] text-muted">Nothing is overdue or due today.</p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {query.data.items.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    drawer.open(task.id)
                  }}
                  className="flex w-full flex-col gap-1 px-4 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="truncate text-[13px] text-foreground">{task.title}</span>
                  <span className="flex items-center gap-3">
                    <DueDate due={task.due_date} done={false} />
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-subtle">
                      <ProjectDot color={task.project.color} />
                      <span className="truncate">{task.project.name}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border px-4 py-2.5">
          <Link
            to="/tasks?due=overdue"
            onClick={() => setOpen(false)}
            className="text-[12.5px] font-medium text-accent-text hover:underline hover:underline-offset-4"
          >
            View all overdue tasks
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
