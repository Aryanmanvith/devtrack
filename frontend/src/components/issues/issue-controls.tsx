import {
  CircleCheck,
  CircleDotDashed,
  CircleSlash,
  Ellipsis,
  PanelRightOpen,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu'
import { useIssueDrawer } from '@/hooks/use-drawers'
import { useConfirmDeleteIssue, useIssueStatus } from '@/hooks/use-entity-actions'
import type { Issue } from '@/lib/api/types'
import { useDialogs } from '@/providers/dialogs'

/** Resolve / close / reopen buttons shown wherever an issue's state can change. */
export function IssueStatusActions({ issue, size = 'sm' }: { issue: Issue; size?: 'sm' | 'md' }) {
  const { setStatus, pending } = useIssueStatus()
  const closed = issue.status === 'resolved' || issue.status === 'closed'
  if (closed) {
    return (
      <Button size={size} onClick={() => setStatus(issue, 'open')} disabled={pending}>
        <RotateCcw aria-hidden />
        Reopen
      </Button>
    )
  }
  return (
    <>
      {issue.status === 'open' ? (
        <Button
          size={size}
          variant="ghost"
          onClick={() => setStatus(issue, 'in_progress')}
          disabled={pending}
        >
          <CircleDotDashed aria-hidden />
          Start progress
        </Button>
      ) : null}
      <Button size={size} onClick={() => setStatus(issue, 'resolved')} disabled={pending}>
        <CircleCheck aria-hidden />
        Resolve
      </Button>
      <Button
        size={size}
        variant="ghost"
        onClick={() => setStatus(issue, 'closed')}
        disabled={pending}
      >
        <CircleSlash aria-hidden />
        Close
      </Button>
    </>
  )
}

export function IssueActionsMenu({ issue }: { issue: Issue }) {
  const dialogs = useDialogs()
  const drawer = useIssueDrawer()
  const { setStatus } = useIssueStatus()
  const confirmDelete = useConfirmDeleteIssue()
  const closed = issue.status === 'resolved' || issue.status === 'closed'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`More actions for ${issue.title}`}>
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => drawer.open(issue.id)}>
          <PanelRightOpen aria-hidden />
          Open details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => dialogs.editIssue(issue)}>
          <Pencil aria-hidden />
          Edit issue
        </DropdownMenuItem>
        {closed ? (
          <DropdownMenuItem onSelect={() => setStatus(issue, 'open')}>
            <RotateCcw aria-hidden />
            Reopen
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => setStatus(issue, 'resolved')}>
              <CircleCheck aria-hidden />
              Resolve
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatus(issue, 'closed')}>
              <CircleSlash aria-hidden />
              Close without fixing
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => confirmDelete(issue)}>
          <Trash2 aria-hidden />
          Delete issue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
