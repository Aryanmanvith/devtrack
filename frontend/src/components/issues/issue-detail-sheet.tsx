import { FileQuestion, Pencil, Trash2 } from 'lucide-react'
import { VisuallyHidden } from 'radix-ui'
import { ActivityItem } from '@/components/activity/activity-item'
import { DemoBadge, IssueStatusBadge, IssueTypeIcon, ProjectLink } from '@/components/common/entity'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states'
import { DetailRow, SheetCloseButton } from '@/components/tasks/task-detail-sheet'
import { PriorityMenu } from '@/components/tasks/task-controls'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, SheetContent } from '@/components/ui/dialog'
import { useUpdateIssue } from '@/hooks/mutations'
import { useActivity, useIssue } from '@/hooks/queries'
import { useIssueDrawer } from '@/hooks/use-drawers'
import { ApiError } from '@/lib/api/client'
import type { Issue } from '@/lib/api/types'
import { formatDateTime } from '@/lib/dates'
import { ISSUE_TYPE } from '@/lib/meta'
import { useDialogs } from '@/providers/dialogs'
import { useConfirmDeleteIssue } from '@/hooks/use-entity-actions'
import { IssueStatusActions } from './issue-controls'

function IssueDetail({ issue }: { issue: Issue }) {
  const dialogs = useDialogs()
  const update = useUpdateIssue()
  const confirmDelete = useConfirmDeleteIssue()
  const history = useActivity({ entity_type: 'issue', entity_id: issue.id, limit: 20 })

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 pt-4 pb-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
              <IssueTypeIcon type={issue.type} className="size-3.5" />
              {ISSUE_TYPE[issue.type].label}
            </span>
            <IssueStatusBadge status={issue.status} />
            {issue.is_demo ? <DemoBadge /> : null}
          </div>
          <DialogTitle className="text-[19px] leading-snug font-semibold font-display text-foreground">
            {issue.title}
          </DialogTitle>
        </div>
        <SheetCloseButton />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
        <IssueStatusActions issue={issue} />
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => dialogs.editIssue(issue)}>
            <Pencil aria-hidden />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:text-danger"
            onClick={() => confirmDelete(issue)}
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <dl>
          <DetailRow label="Project">
            <ProjectLink project={issue.project} />
          </DetailRow>
          <DetailRow label="Priority">
            <PriorityMenu
              value={issue.priority}
              subject={issue.title}
              disabled={update.isPending}
              onChange={(priority) =>
                update.mutate({ id: issue.id, changes: { priority }, success: 'Priority updated' })
              }
            />
          </DetailRow>
          <DetailRow label="Opened">{formatDateTime(issue.created_at)}</DetailRow>
          <DetailRow label="Last updated">{formatDateTime(issue.updated_at)}</DetailRow>
          <DetailRow label="Resolved">
            {issue.resolved_at ? (
              formatDateTime(issue.resolved_at)
            ) : (
              <span className="text-subtle">Not yet</span>
            )}
          </DetailRow>
        </dl>
        <h3 className="mt-6 mb-2 text-[12.5px] font-medium text-subtle">Description</h3>
        {issue.description ? (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-foreground">
            {issue.description}
          </p>
        ) : (
          <p className="text-[13px] text-subtle">No description yet.</p>
        )}
        <h3 className="mt-6 mb-1 text-[12.5px] font-medium text-subtle">History</h3>
        {history.isPending ? (
          <RowsSkeleton rows={3} className="px-0" />
        ) : history.isError ? (
          <ErrorState compact error={history.error} onRetry={() => history.refetch()} />
        ) : history.data.items.length === 0 ? (
          <p className="text-[13px] text-subtle">No changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.data.items.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                showProject={false}
                linkEntity={false}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export function IssueDetailSheet() {
  const drawer = useIssueDrawer()
  const query = useIssue(drawer.id)
  const notFound = query.error instanceof ApiError && query.error.isNotFound

  return (
    <Dialog open={drawer.id !== null} onOpenChange={(open) => !open && drawer.close()}>
      <SheetContent aria-describedby={undefined}>
        {query.data ? (
          <IssueDetail issue={query.data} />
        ) : (
          <>
            <VisuallyHidden.Root>
              <DialogTitle>Issue details</DialogTitle>
            </VisuallyHidden.Root>
            <div className="flex justify-end px-4 pt-3">
              <SheetCloseButton />
            </div>
            {notFound ? (
              <EmptyState
                icon={FileQuestion}
                title="This issue no longer exists"
                description="It may have been deleted, or the link is out of date."
                action={
                  <Button variant="secondary" onClick={drawer.close}>
                    Close
                  </Button>
                }
              />
            ) : query.isError ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : (
              <RowsSkeleton rows={6} />
            )}
          </>
        )}
      </SheetContent>
    </Dialog>
  )
}
