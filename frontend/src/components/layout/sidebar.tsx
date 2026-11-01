import { Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { Logo } from '@/components/common/logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Tooltip,
} from '@/components/ui/menu'
import { useDashboardSummary, usePreferences } from '@/hooks/queries'
import type { Theme } from '@/lib/api/types'
import { cn, initials } from '@/lib/utils'
import { useTheme } from '@/providers/theme'
import { NAV_ITEMS } from './nav'

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'Match system', icon: Monitor },
]

export function ThemeMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0]!
  const Icon = current.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Theme: ${current.label}. Change theme`}>
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? 'right' : 'top'} align={collapsed ? 'end' : 'end'}>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {THEMES.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon aria-hidden />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function NavList({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const summary = useDashboardSummary()
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const count = item.count ? summary.data?.[item.count] : undefined
        const link = (
          <NavLink
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            aria-label={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex h-9 items-center gap-3 rounded-[9px] text-[13.5px] font-medium transition-colors',
                collapsed ? 'justify-center px-0' : 'px-2.5',
                isActive
                  ? 'bg-surface-2 text-foreground before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-primary'
                  : 'text-muted hover:bg-surface-2/70 hover:text-foreground',
              )
            }
          >
            <item.icon className="size-[17px] shrink-0" aria-hidden />
            {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
            {!collapsed && count ? (
              <span className="rounded-full bg-surface-2 px-1.5 text-[11.5px] leading-[18px] text-subtle tabular group-[.active]:bg-raised">
                {count}
              </span>
            ) : null}
          </NavLink>
        )
        return (
          <li key={item.to}>
            {collapsed ? (
              <Tooltip content={item.label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ProfileLink({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const preferences = usePreferences()
  const name = preferences.data?.display_name ?? ''
  return (
    <Link
      to="/settings"
      onClick={onNavigate}
      aria-label={`${name || 'Profile'}: open settings`}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2.5 rounded-[9px] p-1.5 transition-colors hover:bg-surface-2',
        collapsed && 'flex-none justify-center',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--violet))] text-[12px] font-semibold text-white">
        {name ? initials(name) : ''}
      </span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-foreground">
            {name || ' '}
          </span>
          <span className="block truncate text-[11.5px] text-subtle">Local workspace</span>
        </span>
      ) : null}
    </Link>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-[color-mix(in_oklab,var(--surface)_55%,var(--background))] transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[68px]' : 'w-[244px]',
      )}
      aria-label="Primary"
    >
      <div className={cn('flex h-14 items-center', collapsed ? 'justify-center' : 'px-4')}>
        <Link to="/" aria-label="DevTrack overview" className="rounded-md">
          <Logo collapsed={collapsed} />
        </Link>
      </div>
      <nav
        className={cn('flex-1 overflow-y-auto py-3', collapsed ? 'px-2.5' : 'px-3')}
        aria-label="Main"
      >
        <NavList collapsed={collapsed} />
      </nav>
      <div
        className={cn(
          'border-t border-border p-2.5',
          collapsed ? 'flex flex-col items-center gap-1.5' : 'flex items-center gap-1',
        )}
      >
        <ProfileLink collapsed={collapsed} />
        <ThemeMenu collapsed={collapsed} />
        <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="right">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </Button>
        </Tooltip>
      </div>
    </aside>
  )
}
