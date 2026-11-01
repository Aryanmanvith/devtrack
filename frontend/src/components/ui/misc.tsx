import { Tabs as TabsPrimitive, ToggleGroup } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-md bg-[color-mix(in_oklab,var(--border)_70%,transparent)]',
        className,
      )}
      {...props}
    />
  )
}

export function ProgressBar({
  value,
  label,
  className,
  color,
}: {
  value: number
  label: string
  className?: string
  color?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--border)_85%,transparent)]',
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%`, background: color ?? 'var(--primary)' }}
      />
    </div>
  )
}

export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-[14px] border border-border bg-surface shadow-panel', className)}
      {...props}
    />
  )
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
  titleId,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  titleId?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-4 pb-3', className)}>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-[14px] font-semibold text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-[12.5px] text-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Single-choice segmented control (radio semantics, arrow-key navigation). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'sm',
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T)
      }}
      aria-label={label}
      className={cn(
        'inline-flex items-center rounded-[9px] border border-border bg-surface-2 p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          title={option.title}
          aria-label={option.title}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium text-muted transition-colors hover:text-foreground data-[state=on]:bg-raised data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_2px_rgb(0_0_0/0.18)] [&_svg]:size-3.5',
            size === 'sm' ? 'h-7' : 'h-8',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex items-center gap-1 border-b border-border', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px inline-flex h-9 items-center gap-2 border-b-2 border-transparent px-3 text-[13px] font-medium text-muted transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
