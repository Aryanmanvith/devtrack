/**
 * Write operations. Success messages appear only after the server confirms a change.
 * Every mutation, successful or not, invalidates the workspace queries so counts,
 * charts, progress bars and the activity feed always reflect the database.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/api/client'
import { api } from '@/lib/api/endpoints'
import type {
  Issue,
  IssueInput,
  Page,
  Preferences,
  Project,
  ProjectInput,
  Task,
  TaskPatch,
} from '@/lib/api/types'
import { invalidateWorkspace, qk } from '@/lib/query-keys'

interface Options {
  /** Forms show errors inline instead of in a toast. */
  toastErrors?: boolean
}

function onErrorToast(enabled: boolean, prefix: string) {
  return (error: unknown) => {
    if (enabled) toast.error(prefix, { description: errorMessage(error) })
  }
}

// ---- Projects ------------------------------------------------------------------------------

export function useCreateProject({ toastErrors = true }: Options = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectInput) => api.projects.create(input),
    onSuccess: (project) => {
      qc.setQueryData(qk.project(project.id), project)
      toast.success('Project created', { description: project.name })
    },
    onError: onErrorToast(toastErrors, 'Could not create the project'),
    onSettled: () => invalidateWorkspace(qc),
  })
}

export function useUpdateProject({ toastErrors = true }: Options = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: number
      changes: Partial<ProjectInput>
      success?: string
    }) => api.projects.update(id, changes),
    onSuccess: (project, vars) => {
      qc.setQueryData(qk.project(project.id), project)
      toast.success(vars.success ?? 'Project saved', { description: project.name })
    },
    onError: onErrorToast(toastErrors, 'Could not update the project'),
    onSettled: () => invalidateWorkspace(qc),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (project: Pick<Project, 'id' | 'name'>) => api.projects.remove(project.id),
    onSuccess: (_data, project) => {
      qc.removeQueries({ queryKey: qk.project(project.id) })
      toast.success('Project deleted', { description: project.name })
    },
    onError: onErrorToast(true, 'Could not delete the project'),
    onSettled: () => invalidateWorkspace(qc),
  })
}

// ---- Tasks ---------------------------------------------------------------------------------

/** Apply a patch to every cached copy of a task; returns a function that restores them. */
function patchTaskCaches(qc: QueryClient, id: number, changes: TaskPatch) {
  const lists = qc.getQueriesData<Page<Task>>({ queryKey: ['tasks', 'list'] })
  const detail = qc.getQueryData<Task>(qk.task(id))
  qc.setQueriesData<Page<Task>>({ queryKey: ['tasks', 'list'] }, (page) =>
    page
      ? {
          ...page,
          items: page.items.map((task) => (task.id === id ? { ...task, ...changes } : task)),
        }
      : page,
  )
  if (detail) qc.setQueryData<Task>(qk.task(id), { ...detail, ...changes })
  return () => {
    for (const [key, data] of lists) qc.setQueryData(key, data)
    if (detail) qc.setQueryData(qk.task(id), detail)
  }
}

export interface TaskPatchVars {
  id: number
  changes: TaskPatch
  /** Update cached lists immediately and roll back if the server rejects the change. */
  optimistic?: boolean
  /** Toast shown after the server confirms; false for none. */
  success?: string | false
  /** Toast title used if the request fails. */
  failure?: string
  /** Called once the optimistic cache update has been applied. */
  onOptimistic?: () => void
}

export function useUpdateTask({ toastErrors = true }: Options = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: TaskPatchVars) => api.tasks.update(id, changes),
    onMutate: async (vars) => {
      if (!vars.optimistic) return { restore: undefined }
      await qc.cancelQueries({ queryKey: qk.tasks })
      const restore = patchTaskCaches(qc, vars.id, vars.changes)
      vars.onOptimistic?.()
      return { restore }
    },
    onError: (error, vars, context) => {
      context?.restore?.()
      if (toastErrors) {
        toast.error(vars.failure ?? 'Could not update the task', {
          description: vars.optimistic
            ? `${errorMessage(error)} The change was undone.`
            : errorMessage(error),
        })
      }
    },
    onSuccess: (task, vars) => {
      qc.setQueryData(qk.task(task.id), task)
      if (vars.success !== false)
        toast.success(vars.success ?? 'Task saved', { description: task.title })
    },
    onSettled: () => invalidateWorkspace(qc),
  })
}

export function useCreateTask({ toastErrors = true }: Options = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.tasks.create,
    onSuccess: (task) => {
      qc.setQueryData(qk.task(task.id), task)
      toast.success('Task created', { description: task.title })
    },
    onError: onErrorToast(toastErrors, 'Could not create the task'),
    onSettled: () => invalidateWorkspace(qc),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (task: Pick<Task, 'id' | 'title'>) => api.tasks.remove(task.id),
    onSuccess: (_data, task) => {
      qc.removeQueries({ queryKey: qk.task(task.id) })
      toast.success('Task deleted', { description: task.title })
    },
    onError: onErrorToast(true, 'Could not delete the task'),
    onSettled: () => invalidateWorkspace(qc),
  })
}

// ---- Issues --------------------------------------------------------------------------------

export function useCreateIssue({ toastErrors = true }: Options = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.issues.create,
    onSuccess: (issue) => {
      qc.setQueryData(qk.issue(issue.id), issue)
      toast.success('Issue created', { description: issue.title })
    },
    onError: onErrorToast(toastErrors, 'Could not create the issue'),
    onSettled: () => invalidateWorkspace(qc),
  })
}

export function useUpdateIssue({ toastErrors = true }: Options = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<IssueInput>; success?: string }) =>
      api.issues.update(id, changes),
    onSuccess: (issue: Issue, vars) => {
      qc.setQueryData(qk.issue(issue.id), issue)
      toast.success(vars.success ?? 'Issue saved', { description: issue.title })
    },
    onError: onErrorToast(toastErrors, 'Could not update the issue'),
    onSettled: () => invalidateWorkspace(qc),
  })
}

export function useDeleteIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (issue: Pick<Issue, 'id' | 'title'>) => api.issues.remove(issue.id),
    onSuccess: (_data, issue) => {
      qc.removeQueries({ queryKey: qk.issue(issue.id) })
      toast.success('Issue deleted', { description: issue.title })
    },
    onError: onErrorToast(true, 'Could not delete the issue'),
    onSettled: () => invalidateWorkspace(qc),
  })
}

// ---- Preferences and demo data -------------------------------------------------------------

type PreferencesPatch = Partial<Pick<Preferences, 'display_name' | 'theme' | 'week_start'>>

export function useUpdatePreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ changes }: { changes: PreferencesPatch; success?: string | false }) =>
      api.preferences.update(changes),
    onMutate: async ({ changes }) => {
      await qc.cancelQueries({ queryKey: qk.preferences })
      const previous = qc.getQueryData<Preferences>(qk.preferences)
      if (previous) qc.setQueryData<Preferences>(qk.preferences, { ...previous, ...changes })
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) qc.setQueryData(qk.preferences, context.previous)
      toast.error('Could not save your settings', { description: errorMessage(error) })
    },
    onSuccess: (prefs, vars) => {
      qc.setQueryData(qk.preferences, prefs)
      if (vars.success !== false) toast.success(vars.success ?? 'Settings saved')
    },
    onSettled: (_data, _error, vars) => {
      void qc.invalidateQueries({ queryKey: qk.preferences })
      // The week start changes what "this week" means for every metric.
      if (vars.changes.week_start) void invalidateWorkspace(qc)
    },
  })
}

export function useLoadDemo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.demo.load,
    onSuccess: (status) =>
      toast.success('Demo data loaded', {
        description: `${status.projects} projects, ${status.tasks} tasks and ${status.issues} issues tagged Demo.`,
      }),
    onError: onErrorToast(true, 'Could not load demo data'),
    onSettled: () => invalidateWorkspace(qc),
  })
}

export function useRemoveDemo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.demo.remove,
    onSuccess: (result) => {
      qc.removeQueries({ queryKey: ['projects', 'detail'] })
      qc.removeQueries({ queryKey: ['tasks', 'detail'] })
      qc.removeQueries({ queryKey: ['issues', 'detail'] })
      toast.success('Demo data removed', {
        description: `${result.removed_projects} projects, ${result.removed_tasks} tasks and ${result.removed_issues} issues deleted.`,
      })
    },
    onError: onErrorToast(true, 'Could not remove demo data'),
    onSettled: () => invalidateWorkspace(qc),
  })
}
