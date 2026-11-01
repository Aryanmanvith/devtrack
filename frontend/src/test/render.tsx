import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/root-layout'
import { routes } from '@/app/routes'

/** Render the real application (router, providers, shell and lazy pages) at a URL. */
export function renderApp(path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const view = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...view, user, router, queryClient }
}

export function currentSearch(router: ReturnType<typeof createMemoryRouter>) {
  return new URLSearchParams(router.state.location.search)
}
