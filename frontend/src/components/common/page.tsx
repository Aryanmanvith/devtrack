import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PageContainer({
  className,
  children,
  narrow = false,
}: {
  className?: string
  children: ReactNode
  /** Limit the content width while keeping the same left edge as other pages. */
  narrow?: boolean
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1360px] px-4 pt-6 pb-16 sm:px-6 lg:px-8', className)}>
      {narrow ? <div className="max-w-5xl">{children}</div> : children}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {meta ? <div className="mb-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
        <h1 className="text-[26px] leading-tight font-semibold font-display text-foreground sm:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13.5px] text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export interface ActiveFilter {
  key: string
  label: string
  value: string
  onRemove: () => void
}

/** Visible summary of applied filters, each removable, plus a clear-all action. */
export function FilterChips({
  filters,
  onClearAll,
  resultLabel,
  trailing,
}: {
  filters: ActiveFilter[]
  onClearAll: () => void
  resultLabel?: string
  /** Controls shown at the end of the row, such as sorting. */
  trailing?: ReactNode
}) {
  if (filters.length === 0 && !resultLabel && !trailing) return null
  return (
    <div
      className="mb-3 flex min-h-8 flex-wrap items-center gap-2"
      role="group"
      aria-label="Results and active filters"
    >
      {resultLabel ? <span className="mr-1 text-[12.5px] text-subtle">{resultLabel}</span> : null}
      {filters.map((filter) => (
        <span
          key={filter.key}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/35 bg-primary-soft pr-1 pl-2.5 text-[12px] text-foreground"
        >
          <span className="text-muted">{filter.label}:</span>
          <span className="font-medium">{filter.value}</span>
          <button
            type="button"
            onClick={filter.onRemove}
            className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label={`Remove filter ${filter.label}: ${filter.value}`}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {filters.length ? (
        <Button variant="link" size="sm" className="h-7 text-[12.5px]" onClick={onClearAll}>
          Clear all
        </Button>
      ) : null}
      {trailing ? <div className="ml-auto flex items-center gap-1.5">{trailing}</div> : null}
    </div>
  )
}
