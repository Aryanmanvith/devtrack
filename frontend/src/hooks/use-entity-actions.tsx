import { useDeleteIssue, useDeleteTask, useUpdateIssue } from '@/hooks/mutations'
import { useIssueDrawer, useTaskDrawer } from '@/hooks/use-drawers'
import type { Issue, IssueStatus, Task } from '@/lib/api/types'
import { useDialogs } from '@/providers/dialogs'

export function useConfirmDeleteTask() {
  const dialogs = useDialogs()
  const remove = useDeleteTask()
  const drawer = useTaskDrawer()
  return (task: Task) =>
    dialogs.confirm({
      title: 'Delete this task?',
      description: (
        <>
          <strong className="font-medium text-foreground">{task.title}</strong> will be permanently
          deleted. The activity log keeps a record that it existed.
        </>
      ),
      confirmLabel: 'Delete task',
      onConfirm: async () => {
        await remove.mutateAsync(task)
        if (drawer.id === task.id) drawer.close()
      },
    })
}

const STATUS_MESSAGES: Record<IssueStatus, string> = {
  open: 'Issue reopened',
  in_progress: 'Issue marked in progress',
  resolved: 'Issue resolved',
  closed: 'Issue closed',
}

export function useIssueStatus() {
  const update = useUpdateIssue()
  return {
    pending: update.isPending,
    setStatus: (issue: Issue, status: IssueStatus) =>
      update.mutate({ id: issue.id, changes: { status }, success: STATUS_MESSAGES[status] }),
  }
}

export function useConfirmDeleteIssue() {
  const dialogs = useDialogs()
  const remove = useDeleteIssue()
  const drawer = useIssueDrawer()
  return (issue: Issue) =>
    dialogs.confirm({
      title: 'Delete this issue?',
      description: (
        <>
          <strong className="font-medium text-foreground">{issue.title}</strong> will be permanently
          deleted. Consider closing it instead if you want to keep the record.
        </>
      ),
      confirmLabel: 'Delete issue',
      onConfirm: async () => {
        await remove.mutateAsync(issue)
        if (drawer.id === issue.id) drawer.close()
      },
    })
}
