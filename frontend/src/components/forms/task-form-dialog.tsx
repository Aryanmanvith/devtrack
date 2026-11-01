import { zodResolver } from '@hookform/resolvers/zod'
import { FolderPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ProjectDot } from '@/components/common/entity'
import { EmptyState, InlineAlert } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input, Textarea, fieldAria } from '@/components/ui/form'
import { useCreateTask, useUpdateTask } from '@/hooks/mutations'
import { useLabels, useProjectOptions } from '@/hooks/queries'
import { errorMessage } from '@/lib/api/client'
import type { Priority, ProjectBrief, Task, TaskInput, TaskStatus } from '@/lib/api/types'
import { PRIORITY, PRIORITY_ORDER, TASK_STATUS, TASK_STATUS_ORDER } from '@/lib/meta'
import { applyServerErrors, isoDateField, parseLabels } from '@/lib/form-utils'
import { SelectField } from './shared'

const LABEL_PATTERN = /^[a-z0-9][a-z0-9-]*$/

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the task a title.')
    .max(200, 'Keep the title under 200 characters.'),
  description: z.string().max(5000, 'Keep the description under 5,000 characters.'),
  project_id: z.string().min(1, 'Choose a project.'),
  status: z.enum(TASK_STATUS_ORDER as [TaskStatus, ...TaskStatus[]]),
  priority: z.enum(PRIORITY_ORDER as [Priority, ...Priority[]]),
  due_date: isoDateField,
  labels: z
    .string()
    .refine((v) => parseLabels(v).length <= 6, 'Use at most 6 labels.')
    .refine(
      (v) => parseLabels(v).every((label) => label.length <= 24 && LABEL_PATTERN.test(label)),
      'Labels can contain letters, numbers and hyphens (up to 24 characters each).',
    ),
})

type Values = z.input<typeof schema>
const FIELDS = [
  'title',
  'description',
  'project_id',
  'status',
  'priority',
  'due_date',
  'labels',
] as const

export interface TaskFormDefaults {
  projectId?: number
  status?: TaskStatus
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaults,
  onCreateProject,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task
  defaults?: TaskFormDefaults
  onCreateProject: () => void
}) {
  const editing = Boolean(task)
  const create = useCreateTask({ toastErrors: false })
  const update = useUpdateTask({ toastErrors: false })
  const mutation = editing ? update : create
  const projects = useProjectOptions()
  const labels = useLabels()

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      project_id: String(task?.project_id ?? defaults?.projectId ?? ''),
      status: task?.status ?? defaults?.status ?? 'todo',
      priority: task?.priority ?? 'medium',
      due_date: task?.due_date ?? '',
      labels: task?.labels.join(', ') ?? '',
    },
  })

  const projectChoices: ProjectBrief[] = [...(projects.data?.items ?? [])]
  if (task && !projectChoices.some((p) => p.id === task.project_id))
    projectChoices.unshift(task.project)
  const noProjects = projects.isSuccess && projectChoices.length === 0

  const onSubmit = handleSubmit((values) => {
    if (mutation.isPending) return
    const payload: TaskInput = {
      title: values.title,
      description: values.description.trim(),
      project_id: Number(values.project_id),
      status: values.status,
      priority: values.priority,
      due_date: values.due_date || null,
      labels: parseLabels(values.labels),
    }
    const callbacks = {
      onSuccess: () => onOpenChange(false),
      onError: (error: unknown) => applyServerErrors(error, setError, FIELDS),
    }
    if (task) update.mutate({ id: task.id, changes: payload }, callbacks)
    else create.mutate(payload, callbacks)
  })

  const addLabel = (name: string) => {
    const current = parseLabels(getValues('labels'))
    if (current.includes(name)) return
    setValue('labels', [...current, name].join(', '), { shouldDirty: true, shouldValidate: true })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent aria-describedby="task-form-description" className="max-w-xl">
        {noProjects ? (
          <>
            <DialogHeader>
              <DialogTitle>Create task</DialogTitle>
              <DialogDescription id="task-form-description">
                Every task belongs to a project.
              </DialogDescription>
            </DialogHeader>
            <EmptyState
              compact
              icon={FolderPlus}
              title="Create a project first"
              description="Tasks need a project to live in. Create one, then add tasks to it."
              action={
                <Button variant="primary" onClick={onCreateProject}>
                  Create project
                </Button>
              }
            />
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit task' : 'Create task'}</DialogTitle>
              <DialogDescription id="task-form-description">
                {editing
                  ? 'Update the details of this task.'
                  : 'Add an actionable piece of work to a project.'}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              {mutation.isError ? <InlineAlert>{errorMessage(mutation.error)}</InlineAlert> : null}
              <Field label="Title" htmlFor="task-title" error={errors.title?.message}>
                <Input
                  {...register('title')}
                  {...fieldAria('task-title', errors.title?.message)}
                  placeholder="e.g. Write API tests for the login flow"
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Description"
                htmlFor="task-description"
                optional
                error={errors.description?.message}
              >
                <Textarea
                  {...register('description')}
                  {...fieldAria('task-description', errors.description?.message)}
                  rows={3}
                  placeholder="Acceptance criteria, links or notes"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  control={control}
                  name="project_id"
                  id="task-project"
                  label="Project"
                  placeholder={projects.isLoading ? 'Loading projects…' : 'Choose a project'}
                  error={errors.project_id?.message}
                  options={projectChoices.map((p) => ({
                    value: String(p.id),
                    label: (
                      <>
                        <ProjectDot color={p.color} />
                        {p.name}
                      </>
                    ),
                  }))}
                />
                <Field
                  label="Deadline"
                  htmlFor="task-due"
                  optional
                  error={errors.due_date?.message}
                >
                  <Input
                    type="date"
                    {...register('due_date')}
                    {...fieldAria('task-due', errors.due_date?.message)}
                  />
                </Field>
                <SelectField
                  control={control}
                  name="status"
                  id="task-status"
                  label="Status"
                  error={errors.status?.message}
                  options={TASK_STATUS_ORDER.map((s) => ({
                    value: s,
                    label: TASK_STATUS[s].label,
                  }))}
                />
                <SelectField
                  control={control}
                  name="priority"
                  id="task-priority"
                  label="Priority"
                  error={errors.priority?.message}
                  options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY[p].label }))}
                />
              </div>
              <Field
                label="Labels"
                htmlFor="task-labels"
                optional
                error={errors.labels?.message}
                hint="Separate labels with commas, for example: frontend, testing"
              >
                <Input
                  {...register('labels')}
                  {...fieldAria('task-labels', errors.labels?.message, true)}
                  placeholder="frontend, testing"
                  autoComplete="off"
                />
              </Field>
              {labels.data && labels.data.length > 0 ? (
                <div className="-mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[12px] text-subtle">Used before:</span>
                  {labels.data.slice(0, 10).map((label) => (
                    <button
                      key={label.name}
                      type="button"
                      onClick={() => addLabel(label.name)}
                      className="rounded-[5px] border border-border bg-surface-2 px-1.5 text-[11.5px] leading-5 text-muted transition-colors hover:border-border-strong hover:text-foreground"
                    >
                      {label.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={mutation.isPending}>
                {editing ? 'Save changes' : 'Create task'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
