import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Project } from '@/lib/api/types'
import { makeProject, page } from '@/test/fixtures'
import { apiError, mockApi, reply } from '@/test/mock-api'
import { renderApp } from '@/test/render'

async function openCreateDialog(user: ReturnType<typeof renderApp>['user']) {
  const [button] = await screen.findAllByRole('button', { name: 'Create project' })
  await user.click(button!)
  return screen.findByRole('dialog', { name: 'Create project' })
}

describe('Project forms', () => {
  it('validates required fields without calling the API', async () => {
    const api = mockApi()
    const { user } = renderApp('/projects')
    const dialog = await openCreateDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))
    expect(
      await within(dialog).findByText('Name must be at least 2 characters.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(api.find('POST', '/api/projects')).toHaveLength(0)
  })

  it('rejects a deadline before the start date', async () => {
    const api = mockApi()
    const { user } = renderApp('/projects')
    const dialog = await openCreateDialog(user)

    await user.type(within(dialog).getByLabelText('Name'), 'Robotics')
    fireEvent.change(within(dialog).getByLabelText(/Start date/), {
      target: { value: '2026-05-10' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Deadline/), { target: { value: '2026-05-01' } })
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))

    expect(
      await within(dialog).findByText('Deadline must be on or after the start date.'),
    ).toBeInTheDocument()
    expect(api.find('POST', '/api/projects')).toHaveLength(0)
  })

  it('creates a project and confirms only after the server responds', async () => {
    const created: Project[] = []
    const api = mockApi({
      'GET /api/projects': () => ({ body: page(created) }),
      'POST /api/projects': (request) => {
        const project = makeProject({ id: 9, ...(request.body as Partial<Project>), task_count: 0 })
        created.push(project)
        return { status: 201, body: project }
      },
    })
    const { user } = renderApp('/projects')
    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    const dialog = await openCreateDialog(user)

    await user.type(within(dialog).getByLabelText('Name'), '  Robotics Club  ')
    await user.type(within(dialog).getByLabelText(/Description/), 'Line-following robot')
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))

    await waitFor(() => expect(api.find('POST', '/api/projects')).toHaveLength(1))
    expect(api.find('POST', '/api/projects')[0]?.body).toEqual({
      name: 'Robotics Club',
      description: 'Line-following robot',
      status: 'active',
      color: 'indigo',
      owner: 'Ada',
      start_date: null,
      due_date: null,
    })
    expect(await screen.findByText('Project created')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('link', { name: 'Robotics Club' })).toHaveAttribute(
      'href',
      '/projects/9',
    )
  })

  it('shows server-side conflicts on the field and keeps what was typed', async () => {
    mockApi({
      'POST /api/projects': reply(
        409,
        apiError('A project named "Robotics" already exists.', 'conflict', [
          { field: 'name', message: 'A project named "Robotics" already exists.' },
        ]),
      ),
    })
    const { user } = renderApp('/projects')
    const dialog = await openCreateDialog(user)
    await user.type(within(dialog).getByLabelText('Name'), 'Robotics')
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))

    expect(
      await within(dialog).findAllByText('A project named "Robotics" already exists.'),
    ).not.toHaveLength(0)
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Robotics')
    expect(screen.getByRole('dialog', { name: 'Create project' })).toBeInTheDocument()
    expect(screen.queryByText('Project created')).not.toBeInTheDocument()
  })

  it('edits an existing project with its values pre-filled', async () => {
    const project = makeProject({ id: 4, name: 'Capstone Tracker' })
    const api = mockApi({
      'GET /api/projects': page([project]),
      'PATCH /api/projects/:id': (request) => ({
        body: { ...project, ...(request.body as object) },
      }),
    })
    const { user } = renderApp('/projects')
    await user.click(await screen.findByRole('button', { name: 'Actions for Capstone Tracker' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit project' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit project' })
    const name = within(dialog).getByLabelText('Name')
    expect(name).toHaveValue('Capstone Tracker')
    await user.clear(name)
    await user.type(name, 'Capstone Tracker v2')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.find('PATCH', '/api/projects/4')).toHaveLength(1))
    expect(api.find('PATCH', '/api/projects/4')[0]?.body).toMatchObject({
      name: 'Capstone Tracker v2',
    })
    expect(await screen.findByText('Project saved')).toBeInTheDocument()
  })

  it('asks for confirmation before deleting a project', async () => {
    const project = makeProject({ id: 4, name: 'Old project' })
    const api = mockApi({
      'GET /api/projects': page([project]),
      'DELETE /api/projects/:id': reply(204),
    })
    const { user } = renderApp('/projects')
    await user.click(await screen.findByRole('button', { name: 'Actions for Old project' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete project' }))

    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Old project?' })
    expect(api.find('DELETE', '/api/projects/4')).toHaveLength(0)
    await user.click(within(confirm).getByRole('button', { name: 'Delete project' }))
    await waitFor(() => expect(api.find('DELETE', '/api/projects/4')).toHaveLength(1))
    expect(await screen.findByText('Project deleted')).toBeInTheDocument()
  })
})
