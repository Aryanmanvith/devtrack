import { CircleAlert, RotateCcw, WifiOff, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { ApiError, errorMessage } from '@/lib/api/client'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2">
        <Icon className="size-5 text-subtle" aria-hidden />
      </div>
      <div className="max-w-sm">
        <p className="text-[14px] font-semibold text-foreground">{title}</p>
        {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  title,
  className,
  compact = false,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
  compact?: boolean
}) {
  const offline = error instanceof ApiError && error.code === 'network_error'
  const Icon = offline ? WifiOff : CircleAlert
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-xl border border-danger/30 bg-danger-soft">
        <Icon className="size-5 text-danger" aria-hidden />
      </div>
      <div className="max-w-md">
        <p className="text-[14px] font-semibold text-foreground">
          {title ?? (offline ? 'The API is not reachable' : 'This section failed to load')}
        </p>
        <p className="mt-1 text-[13px] text-muted">{errorMessage(error)}</p>
      </div>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function InlineAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger',
        className,
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn('flex flex-col gap-3 px-5 py-4', className)}
      aria-label="Loading"
      role="status"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${70 - ((index * 13) % 30)}%` }} />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}
