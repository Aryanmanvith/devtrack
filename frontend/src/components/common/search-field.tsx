import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/form'
import { cn } from '@/lib/utils'

/**
 * Debounced search box. The input is uncontrolled so typing is never interrupted by URL
 * updates; when the value changes from outside (for example "Clear all"), the field is
 * updated unless the user is currently typing in it.
 */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  className,
  delay = 300,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  className?: string
  delay?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const input = inputRef.current
    if (input && input.value !== value && document.activeElement !== input) input.value = value
  }, [value])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const emit = (next: string, immediate = false) => {
    window.clearTimeout(timer.current)
    if (immediate) onChange(next.trim())
    else timer.current = window.setTimeout(() => onChange(next.trim()), delay)
  }

  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        defaultValue={value}
        aria-label={label}
        placeholder={placeholder ?? label}
        onChange={(event) => emit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') emit(event.currentTarget.value, true)
          if (event.key === 'Escape' && event.currentTarget.value) {
            event.currentTarget.value = ''
            emit('', true)
          }
        }}
        className="pr-8 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            if (inputRef.current) inputRef.current.value = ''
            emit('', true)
          }}
          className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-subtle hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
