import {
  Activity,
  ChartColumn,
  CircleAlert,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Settings,
  SquareKanban,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Which dashboard count to show next to the item, if any. */
  count?: 'open_tasks' | 'open_issues'
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/tasks', label: 'My Tasks', icon: ListTodo, count: 'open_tasks' },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/board', label: 'Kanban Board', icon: SquareKanban },
  { to: '/issues', label: 'Issues', icon: CircleAlert, count: 'open_issues' },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/analytics', label: 'Analytics', icon: ChartColumn },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function pageTitle(pathname: string) {
  if (pathname === '/') return 'Overview'
  const match = NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to))
  return match?.label ?? 'Not found'
}
