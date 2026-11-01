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
import { useCreateIssue, useUpdateIssue } from '@/hooks/mutations'
import { useProjectOptions } from '@/hooks/queries'
import { errorMessage } from '@/lib/api/client'
import type {
  Issue,
  IssueInput,
  IssueStatus,
  IssueType,
  Priority,
  ProjectBrief,
} from '@/lib/api/types'
import {
  ISSUE_STATUS,
  ISSUE_STATUS_ORDER,
  ISSUE_TYPE,
  ISSUE_TYPE_ORDER,
  PRIORITY,
  PRIORITY_ORDER,
} from '@/lib/meta'
import { applyServerErrors } from '@/lib/form-utils'
import { SelectField } from './shared'

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give the issue a title.')
    .max(200, 'Keep the title under 200 characters.'),
  description: z.string().max(5000, 'Keep the description under 5,000 characters.'),
  project_id: z.string().min(1, 'Choose a project.'),
  type: z.enum(ISSUE_TYPE_ORDER as [IssueType, ...IssueType[]]),
  priority: z.enum(PRIORITY_ORDER as [Priority, ...Priority[]]),
  status: z.enum(ISSUE_STATUS_ORDER as [IssueStatus, ...IssueStatus[]]),
})

type Values = z.input<typeof schema>
const FIELDS = ['title', 'description', 'project_id', 'type', 'priority', 'status'] as const

export function IssueFormDialog({
  open,
  onOpenChange,
  issue,
  defaults,
  onCreateProject,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  issue?: Issue
  defaults?: { projectId?: number }
  onCreateProject: () => void
}) {
  const editing = Boolean(issue)
  const create = useCreateIssue({ toastErrors: false })
  const update = useUpdateIssue({ toastErrors: false })
  const mutation = editing ? update : create
  const projects = useProjectOptions()

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: issue?.title ?? '',
      description: issue?.description ?? '',
      project_id: String(issue?.project_id ?? defaults?.projectId ?? ''),
      type: issue?.type ?? 'bug',
      priority: issue?.priority ?? 'medium',
      status: issue?.status ?? 'open',
    },
  })

  const projectChoices: ProjectBrief[] = [...(projects.data?.items ?? [])]
  if (issue && !projectChoices.some((p) => p.id === issue.project_id))
    projectChoices.unshift(issue.project)
  const noProjects = projects.isSuccess && projectChoices.length === 0

  const onSubmit = handleSubmit((values) => {
    if (mutation.isPending) return
    const payload: IssueInput = {
      title: values.title,
      description: values.description.trim(),
      project_id: Number(values.project_id),
      type: values.type,
      priority: values.priority,
      status: values.status,
    }
    const callbacks = {
      onSuccess: () => onOpenChange(false),
      onError: (error: unknown) => applyServerErrors(error, setError, FIELDS),
    }
    if (issue) update.mutate({ id: issue.id, changes: payload }, callbacks)
    else create.mutate(payload, callbacks)
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent aria-describedby="issue-form-description" className="max-w-xl">
        {noProjects ? (
          <>
            <DialogHeader>
              <DialogTitle>Create issue</DialogTitle>
              <DialogDescription id="issue-form-description">
                Every issue belongs to a project.
              </DialogDescription>
            </DialogHeader>
            <EmptyState
              compact
              icon={FolderPlus}
              title="Create a project first"
              description="Issues are tracked per project. Create a project, then report issues against it."
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
              <DialogTitle>{editing ? 'Edit issue' : 'Create issue'}</DialogTitle>
              <DialogDescription id="issue-form-description">
                {editing
                  ? 'Update the details of this issue.'
                  : 'Report a bug, request a feature or ask a question.'}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              {mutation.isError ? <InlineAlert>{errorMessage(mutation.error)}</InlineAlert> : null}
              <Field label="Title" htmlFor="issue-title" error={errors.title?.message}>
                <Input
                  {...register('title')}
                  {...fieldAria('issue-title', errors.title?.message)}
                  placeholder="e.g. Login button does nothing on Safari"
                  autoComplete="off"
                />
              </Field>
              <Field
                label="Description"
                htmlFor="issue-description"
                optional
                error={errors.description?.message}
              >
                <Textarea
                  {...register('description')}
                  {...fieldAria('issue-description', errors.description?.message)}
                  rows={4}
                  placeholder="Steps to reproduce, expected and actual behaviour"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  control={control}
                  name="project_id"
                  id="issue-project"
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
                <SelectField
                  control={control}
                  name="type"
                  id="issue-type"
                  label="Type"
                  error={errors.type?.message}
                  options={ISSUE_TYPE_ORDER.map((t) => ({ value: t, label: ISSUE_TYPE[t].label }))}
                />
                <SelectField
                  control={control}
                  name="priority"
                  id="issue-priority"
                  label="Priority"
                  error={errors.priority?.message}
                  options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY[p].label }))}
                />
                <SelectField
                  control={control}
                  name="status"
                  id="issue-status"
                  label="Status"
                  error={errors.status?.message}
                  options={ISSUE_STATUS_ORDER.map((s) => ({
                    value: s,
                    label: ISSUE_STATUS[s].label,
                  }))}
                />
              </div>
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
                {editing ? 'Save changes' : 'Create issue'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
