import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn('size-7 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path
        d="M10 9.5h5.2a6.5 6.5 0 0 1 0 13H10z"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="22.5" cy="10" r="2.2" fill="#C9BCFF" />
    </svg>
  )
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed ? (
        <span className="text-[16px] font-semibold font-display tracking-tight text-foreground">
          DevTrack
        </span>
      ) : null}
    </span>
  )
}
