import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { InlineAlert } from '@/components/common/states'
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
import { useCreateProject, useUpdateProject } from '@/hooks/mutations'
import { errorMessage } from '@/lib/api/client'
import type { Project, ProjectColor, ProjectInput, ProjectStatus } from '@/lib/api/types'
import {
  PROJECT_COLOR,
  PROJECT_COLOR_ORDER,
  PROJECT_STATUS,
  PROJECT_STATUS_ORDER,
} from '@/lib/meta'
import { cn } from '@/lib/utils'
import { applyServerErrors, emptyToNull, isDateBefore, isoDateField } from '@/lib/form-utils'
import { SelectField } from './shared'

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters.')
      .max(120, 'Keep the name under 120 characters.'),
    description: z.string().max(2000, 'Keep the description under 2,000 characters.'),
    status: z.enum(PROJECT_STATUS_ORDER as [ProjectStatus, ...ProjectStatus[]]),
    color: z.enum(PROJECT_COLOR_ORDER as [ProjectColor, ...ProjectColor[]]),
    owner: z.string().max(80, 'Keep the owner name under 80 characters.'),
    start_date: isoDateField,
    due_date: isoDateField,
  })
  .refine((v) => !v.start_date || !v.due_date || !isDateBefore(v.due_date, v.start_date), {
    path: ['due_date'],
    message: 'Deadline must be on or after the start date.',
  })

type Values = z.input<typeof schema>
const FIELDS = [
  'name',
  'description',
  'status',
  'color',
  'owner',
  'start_date',
  'due_date',
] as const

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  defaultOwner,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project
  defaultOwner?: string
}) {
  const editing = Boolean(project)
  const create = useCreateProject({ toastErrors: false })
  const update = useUpdateProject({ toastErrors: false })
  const mutation = editing ? update : create

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      status: project?.status ?? 'active',
      color: project?.color ?? 'indigo',
      owner: project?.owner ?? defaultOwner ?? '',
      start_date: project?.start_date ?? '',
      due_date: project?.due_date ?? '',
    },
  })
  const selectedColor = useWatch({ control, name: 'color' })

  const onSubmit = handleSubmit((values) => {
    if (mutation.isPending) return
    const payload: ProjectInput = {
      name: values.name,
      description: values.description.trim(),
      status: values.status,
      color: values.color,
      owner: emptyToNull(values.owner),
      start_date: values.start_date || null,
      due_date: values.due_date || null,
    }
    const callbacks = {
      onSuccess: () => onOpenChange(false),
      onError: (error: unknown) => applyServerErrors(error, setError, FIELDS),
    }
    if (project) update.mutate({ id: project.id, changes: payload }, callbacks)
    else create.mutate(payload, callbacks)
  })

  const statusOptions = PROJECT_STATUS_ORDER.filter((s) => editing || s !== 'archived').map(
    (s) => ({
      value: s,
      label: PROJECT_STATUS[s].label,
    }),
  )

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent aria-describedby="project-form-description">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit project' : 'Create project'}</DialogTitle>
            <DialogDescription id="project-form-description">
              {editing
                ? 'Changes are saved to the database and recorded in the activity log.'
                : 'Projects group related tasks and issues. Progress is calculated from tasks.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {mutation.isError ? <InlineAlert>{errorMessage(mutation.error)}</InlineAlert> : null}
            <Field label="Name" htmlFor="project-name" error={errors.name?.message}>
              <Input
                {...register('name')}
                {...fieldAria('project-name', errors.name?.message)}
                placeholder="e.g. Capstone project"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Description"
              htmlFor="project-description"
              optional
              error={errors.description?.message}
            >
              <Textarea
                {...register('description')}
                {...fieldAria('project-description', errors.description?.message)}
                rows={3}
                placeholder="What is this project about?"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={control}
                name="status"
                id="project-status"
                label="Status"
                options={statusOptions}
                error={errors.status?.message}
              />
              <Field label="Owner" htmlFor="project-owner" optional error={errors.owner?.message}>
                <Input
                  {...register('owner')}
                  {...fieldAria('project-owner', errors.owner?.message)}
                  placeholder="Team lead"
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Start date"
                htmlFor="project-start"
                optional
                error={errors.start_date?.message}
              >
                <Input
                  type="date"
                  {...register('start_date')}
                  {...fieldAria('project-start', errors.start_date?.message)}
                />
              </Field>
              <Field
                label="Deadline"
                htmlFor="project-due"
                optional
                error={errors.due_date?.message}
              >
                <Input
                  type="date"
                  {...register('due_date')}
                  {...fieldAria('project-due', errors.due_date?.message)}
                />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-[12.5px] font-medium text-muted">Color</legend>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLOR_ORDER.map((color) => (
                  <label
                    key={color}
                    className="relative cursor-pointer"
                    title={PROJECT_COLOR[color].label}
                  >
                    <input
                      type="radio"
                      value={color}
                      {...register('color')}
                      className="peer sr-only"
                      aria-label={PROJECT_COLOR[color].label}
                    />
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-lg border border-border transition-[box-shadow] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
                        selectedColor === color &&
                          'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ring)]',
                      )}
                    >
                      <span className={cn('size-4 rounded-[5px]', PROJECT_COLOR[color].dot)} />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
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
              {editing ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
