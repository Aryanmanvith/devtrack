import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11.5px] leading-[18px] font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-2 text-muted',
        outline: 'border-border-strong bg-transparent text-muted',
        primary: 'border-transparent bg-primary-soft text-accent-text',
        danger: 'border-transparent bg-danger-soft text-danger',
        demo: 'border-dashed border-border-strong bg-transparent text-subtle',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
