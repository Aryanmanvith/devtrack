import { TriangleAlert } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { IssueFormDialog } from '@/components/forms/issue-form-dialog'
import { ProjectFormDialog } from '@/components/forms/project-form-dialog'
import { TaskFormDialog, type TaskFormDefaults } from '@/components/forms/task-form-dialog'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/dialog'
import { usePreferences } from '@/hooks/queries'
import type { Issue, Project, Task } from '@/lib/api/types'

interface ConfirmOptions {
  title: string
  description: ReactNode
  confirmLabel: string
  /** Runs the action; the dialog stays open (and the action can be retried) if it rejects. */
  onConfirm: () => Promise<unknown>
}

interface DialogsValue {
  createProject: () => void
  editProject: (project: Project) => void
  createTask: (defaults?: TaskFormDefaults) => void
  editTask: (task: Task) => void
  createIssue: (defaults?: { projectId?: number }) => void
  editIssue: (issue: Issue) => void
  confirm: (options: ConfirmOptions) => void
}

type FormState =
  | { kind: 'project'; project?: Project }
  | { kind: 'task'; task?: Task; defaults?: TaskFormDefaults }
  | { kind: 'issue'; issue?: Issue; defaults?: { projectId?: number } }

const DialogsContext = createContext<DialogsValue | null>(null)

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<(FormState & { key: number }) | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmOptions | null>(null)
  const [pending, setPending] = useState(false)
  const counter = useRef(0)
  const preferences = usePreferences()

  const open = useCallback((state: FormState) => {
    counter.current += 1
    setForm({ ...state, key: counter.current })
  }, [])
  const close = useCallback(() => setForm(null), [])

  const value = useMemo<DialogsValue>(
    () => ({
      createProject: () => open({ kind: 'project' }),
      editProject: (project) => open({ kind: 'project', project }),
      createTask: (defaults) => open({ kind: 'task', defaults }),
      editTask: (task) => open({ kind: 'task', task }),
      createIssue: (defaults) => open({ kind: 'issue', defaults }),
      editIssue: (issue) => open({ kind: 'issue', issue }),
      confirm: (options) => setConfirmation(options),
    }),
    [open],
  )

  const runConfirm = async () => {
    if (!confirmation || pending) return
    setPending(true)
    try {
      await confirmation.onConfirm()
      setConfirmation(null)
    } catch {
      // The mutation already reported the error; keep the dialog open so it can be retried.
    } finally {
      setPending(false)
    }
  }

  const onOpenChange = (next: boolean) => {
    if (!next) close()
  }

  return (
    <DialogsContext.Provider value={value}>
      {children}
      {form?.kind === 'project' ? (
        <ProjectFormDialog
          key={form.key}
          open
          onOpenChange={onOpenChange}
          project={form.project}
          defaultOwner={preferences.data?.display_name}
        />
      ) : null}
      {form?.kind === 'task' ? (
        <TaskFormDialog
          key={form.key}
          open
          onOpenChange={onOpenChange}
          task={form.task}
          defaults={form.defaults}
          onCreateProject={() => open({ kind: 'project' })}
        />
      ) : null}
      {form?.kind === 'issue' ? (
        <IssueFormDialog
          key={form.key}
          open
          onOpenChange={onOpenChange}
          issue={form.issue}
          defaults={form.defaults}
          onCreateProject={() => open({ kind: 'project' })}
        />
      ) : null}
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <div className="flex gap-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-soft">
              <TriangleAlert className="size-4.5 text-danger" aria-hidden />
            </div>
            <div className="min-w-0">
              <AlertDialogTitle className="text-[16px] font-semibold font-display text-foreground">
                {confirmation?.title}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="mt-1.5 text-[13px] text-muted">{confirmation?.description}</div>
              </AlertDialogDescription>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel asChild>
              <Button variant="ghost" disabled={pending}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={pending} onClick={runConfirm}>
              {confirmation?.confirmLabel}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DialogsContext.Provider>
  )
}

export function useDialogs() {
  const context = useContext(DialogsContext)
  if (!context) throw new Error('useDialogs must be used inside DialogsProvider')
  return context
}
