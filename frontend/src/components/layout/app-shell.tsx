import { CircleAlert, FolderPlus, ListPlus, Menu, Plus, Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation, useMatch, type Location } from 'react-router'
import { Toaster } from 'sonner'
import { Logo } from '@/components/common/logo'
import { IssueDetailSheet } from '@/components/issues/issue-detail-sheet'
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, SheetContent } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu'
import { useProject } from '@/hooks/queries'
import { useCommandShortcut, useLocalStorageFlag } from '@/hooks/use-utils'
import { positiveInt } from '@/lib/filters'
import { isMac } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'
import { useTheme } from '@/providers/theme'
import { CommandPalette } from './command-palette'
import { DeadlineAlerts } from './deadline-alerts'
import { pageTitle } from './nav'
import { NavList, ProfileLink, Sidebar, ThemeMenu } from './sidebar'

/**
 * Scroll positions are remembered per page, so changing filters or opening a drawer (both only
 * change the query string) never scrolls the page. Positions are kept for Back and Forward
 * within a visit but not across reloads: React Router can apply the restore saved before a
 * reload late, once lazily loaded pages settle, and jump the page while it is being used.
 */
const SCROLL_STORAGE_KEY = 'devtrack-scroll-positions'
try {
  window.sessionStorage.removeItem(SCROLL_STORAGE_KEY)
} catch {
  // Storage can be unavailable (private mode); nothing was saved then either.
}
const scrollKey = (location: Location) => location.pathname

function Breadcrumb() {
  const location = useLocation()
  const match = useMatch('/projects/:projectId')
  const projectId = positiveInt(match?.params.projectId ?? null)
  const project = useProject(projectId)

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
        {match ? (
          <>
            <li>
              <Link to="/projects" className="text-muted transition-colors hover:text-foreground">
                Projects
              </Link>
            </li>
            <li aria-hidden className="text-subtle">
              /
            </li>
            <li aria-current="page" className="truncate font-medium text-foreground">
              {project.data?.name ?? (project.isError ? 'Not found' : 'Loading…')}
            </li>
          </>
        ) : (
          <li aria-current="page" className="truncate font-medium text-foreground">
            {pageTitle(location.pathname)}
          </li>
        )}
      </ol>
    </nav>
  )
}

function CreateMenu() {
  const dialogs = useDialogs()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary" size="sm" aria-label="Create a task, project or issue">
          <Plus aria-hidden />
          <span className="hidden sm:inline">Create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => dialogs.createTask()}>
          <ListPlus aria-hidden />
          Task
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => dialogs.createProject()}>
          <FolderPlus aria-hidden />
          Project
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => dialogs.createIssue()}>
          <CircleAlert aria-hidden />
          Issue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Topbar({ onOpenNav, onOpenSearch }: { onOpenNav: () => void; onOpenSearch: () => void }) {
  const shortcut = isMac ? '⌘K' : 'Ctrl K'
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-[color-mix(in_oklab,var(--background)_86%,transparent)] px-3 backdrop-blur-md sm:gap-3 sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Menu aria-hidden />
      </Button>
      <Breadcrumb />
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={`Search (${shortcut})`}
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        className="flex h-8 items-center gap-2 rounded-[9px] border border-border bg-surface px-2 text-[13px] text-subtle transition-colors hover:border-border-strong hover:text-muted md:w-60 md:px-2.5"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden flex-1 text-left md:inline">Search…</span>
        <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 text-[11px] leading-[18px] font-medium text-subtle md:inline">
          {shortcut}
        </kbd>
      </button>
      <DeadlineAlerts />
      <CreateMenu />
    </header>
  )
}

function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const close = () => onOpenChange(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" aria-describedby={undefined} className="lg:hidden">
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <div className="flex h-14 items-center px-4">
          <Link to="/" onClick={close} aria-label="DevTrack overview">
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
          <NavList onNavigate={close} />
        </nav>
        <div className="flex items-center gap-1 border-t border-border p-2.5">
          <ProfileLink onNavigate={close} />
          <ThemeMenu />
        </div>
      </SheetContent>
    </Dialog>
  )
}

function ThemedToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-xl !border-border-strong !bg-raised !text-foreground !shadow-pop !font-sans',
          description: '!text-muted',
        },
      }}
    />
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useLocalStorageFlag('devtrack-sidebar-collapsed', false)
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const toggleSearch = useCallback(() => setSearchOpen((open) => !open), [])
  useCommandShortcut(toggleSearch)

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setNavOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
      </div>
      <MobileNav open={navOpen} onOpenChange={setNavOpen} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <TaskDetailSheet />
      <IssueDetailSheet />
      <ThemedToaster />
      <ScrollRestoration getKey={scrollKey} storageKey={SCROLL_STORAGE_KEY} />
    </div>
  )
}
