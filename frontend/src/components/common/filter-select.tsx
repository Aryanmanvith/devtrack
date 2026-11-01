import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ALL = '__all__'

/** Compact select for list toolbars. An empty value means "no filter". */
export function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
  className,
  highlight = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  allLabel?: string
  options: { value: string; label: ReactNode }[]
  className?: string
  /** Outline the control while a value is set (filters, not sort orders). */
  highlight?: boolean
}) {
  return (
    <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={cn('w-auto min-w-36', highlight && value && 'border-primary/50', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? (
          <>
            <SelectItem value={ALL}>{allLabel}</SelectItem>
            <SelectSeparator />
          </>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
