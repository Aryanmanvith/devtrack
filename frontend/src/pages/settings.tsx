import { zodResolver } from '@hookform/resolvers/zod'
import { Database, ExternalLink, Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation } from 'react-router'
import { z } from 'zod'
import { PageContainer, PageHeader } from '@/components/common/page'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Field, Input, fieldAria } from '@/components/ui/form'
import { Panel, Segmented, Skeleton } from '@/components/ui/misc'
import { useLoadDemo, useRemoveDemo, useUpdatePreferences } from '@/hooks/mutations'
import { useDemoStatus, useHealth, usePreferences } from '@/hooks/queries'
import { errorMessage } from '@/lib/api/client'
import type { Preferences, Theme, WeekStart } from '@/lib/api/types'
import { plural } from '@/lib/utils'
import { useDialogs } from '@/providers/dialogs'
import { useTheme } from '@/providers/theme'

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_PROXY_TARGET ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '')

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description: ReactNode
  children: ReactNode
}) {
  return (
    <Panel id={id} className="grid scroll-mt-20 gap-4 p-5 md:grid-cols-[16rem_1fr] md:gap-8">
      <div>
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </Panel>
  )
}

const nameSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'Enter a name to show in the app.')
    .max(60, 'Keep the name under 60 characters.'),
})

function DisplayNameForm({ preferences }: { preferences: Preferences }) {
  const update = useUpdatePreferences()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<z.input<typeof nameSchema>, unknown, z.output<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { display_name: preferences.display_name },
  })
  const onSubmit = handleSubmit((values) =>
    update.mutate(
      { changes: values, success: 'Display name saved' },
      { onSuccess: (prefs) => reset({ display_name: prefs.display_name }) },
    ),
  )
  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-3">
      <Field
        label="Display name"
        htmlFor="display-name"
        error={errors.display_name?.message}
        hint="Shown in the greeting and the sidebar."
      >
        <Input
          {...register('display_name')}
          {...fieldAria('display-name', errors.display_name?.message, true)}
          autoComplete="nickname"
        />
      </Field>
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={update.isPending}
          disabled={!isDirty}
        >
          Save name
        </Button>
        {isDirty ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => reset({ display_name: preferences.display_name })}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function DemoDataSection() {
  const demo = useDemoStatus()
  const load = useLoadDemo()
  const remove = useRemoveDemo()
  const dialogs = useDialogs()
  if (demo.isPending) return <Skeleton className="h-16 w-full" />
  if (demo.isError) return <ErrorState compact error={demo.error} onRetry={() => demo.refetch()} />
  const status = demo.data
  const userItems = status.user_tasks_in_demo_projects + status.user_issues_in_demo_projects
  if (!status.has_demo_data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[13px] text-muted">
          No demo data is loaded. Your workspace only contains records you created.
        </p>
        <Button size="sm" loading={load.isPending} onClick={() => load.mutate()}>
          <Database aria-hidden />
          Load demo data
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-[13px] text-muted">
        Loaded: {plural(status.projects, 'project')}, {plural(status.tasks, 'task')} and{' '}
        {plural(status.issues, 'issue')}, each marked{' '}
        <span className="font-medium text-foreground">Demo</span>.
      </p>
      {userItems > 0 ? (
        <p className="rounded-md border border-warning/40 px-3 py-2 text-[12.5px] text-warning">
          You added {plural(status.user_tasks_in_demo_projects, 'task')} and{' '}
          {plural(status.user_issues_in_demo_projects, 'issue')} to demo projects. Removing demo
          data deletes those too.
        </p>
      ) : null}
      <Button
        size="sm"
        variant="danger"
        onClick={() =>
          dialogs.confirm({
            title: 'Remove all demo data?',
            description: (
              <>
                This deletes the {plural(status.projects, 'demo project')} and everything inside
                them
                {userItems > 0 ? (
                  <>, including {plural(userItems, 'item')} you added to them</>
                ) : null}
                . Projects you created yourself are not affected.
              </>
            ),
            confirmLabel: 'Remove demo data',
            onConfirm: () => remove.mutateAsync(),
          })
        }
      >
        Remove demo data
      </Button>
    </div>
  )
}

export function SettingsPage() {
  const preferences = usePreferences()
  const health = useHealth()
  const { theme, setTheme } = useTheme()
  const update = useUpdatePreferences()
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const target = document.getElementById(location.hash.slice(1))
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, preferences.isSuccess])

  return (
    <PageContainer narrow>
      <PageHeader
        title="Settings"
        description="DevTrack runs as a single local workspace without accounts. Settings are saved in your local database."
      />
      {preferences.isError ? (
        <Panel>
          <ErrorState error={preferences.error} onRetry={() => preferences.refetch()} />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          <Section
            title="Profile"
            description="How DevTrack addresses you. There is no sign-in; this name is only stored on this computer."
          >
            {preferences.data ? (
              <DisplayNameForm key={preferences.data.display_name} preferences={preferences.data} />
            ) : (
              <Skeleton className="h-16 w-80" />
            )}
          </Section>
          <Section
            title="Appearance"
            description="Applies immediately and is remembered after a reload."
          >
            <Segmented<Theme>
              label="Theme"
              size="md"
              value={theme}
              onChange={setTheme}
              options={[
                {
                  value: 'dark',
                  label: (
                    <>
                      <Moon aria-hidden /> Dark
                    </>
                  ),
                },
                {
                  value: 'light',
                  label: (
                    <>
                      <Sun aria-hidden /> Light
                    </>
                  ),
                },
                {
                  value: 'system',
                  label: (
                    <>
                      <Monitor aria-hidden /> System
                    </>
                  ),
                },
              ]}
            />
          </Section>
          <Section
            title="Calendar"
            description="Decides which days count as “this week” for weekly metrics, the completion trend and deadlines."
          >
            {preferences.data ? (
              <Segmented<WeekStart>
                label="Week starts on"
                size="md"
                value={preferences.data.week_start}
                onChange={(week_start) =>
                  update.mutate({ changes: { week_start }, success: 'Week start saved' })
                }
                options={[
                  { value: 'monday', label: 'Monday' },
                  { value: 'sunday', label: 'Sunday' },
                ]}
              />
            ) : (
              <Skeleton className="h-8 w-48" />
            )}
          </Section>
          <Section
            id="demo-data"
            title="Demo data"
            description="Sample records make the dashboard meaningful on first run. They are tagged Demo so they never mix with your own work."
          >
            <DemoDataSection />
          </Section>
          <Section
            title="About"
            description="The backend stores everything in backend/data/devtrack.db (SQLite)."
          >
            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[12px] text-subtle">API status</dt>
                <dd className="mt-0.5">
                  {health.data ? (
                    <span className={health.data.status === 'ok' ? 'text-success' : 'text-warning'}>
                      {health.data.status === 'ok' ? 'Connected' : 'Degraded'}, database{' '}
                      {health.data.database}
                    </span>
                  ) : health.isError ? (
                    <span className="text-danger">{errorMessage(health.error)}</span>
                  ) : (
                    'Checking…'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-subtle">API version</dt>
                <dd className="mt-0.5 text-foreground">{health.data?.version ?? '—'}</dd>
              </div>
            </dl>
            <Button asChild size="sm" className="mt-4">
              <a href={`${API_ORIGIN}/docs`} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                Open API documentation
              </a>
            </Button>
          </Section>
        </div>
      )}
    </PageContainer>
  )
}
