import { QueryClient } from '@tanstack/react-query'
import type { RouteObject } from 'react-router'
import { ApiError } from '@/lib/api/client'
import { RootLayout } from './root-layout'
import { AppLoading } from './app-loading'
import { RouteError } from './route-error'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Client errors (404, 422) will not fix themselves; only retry network/server errors.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
      mutations: { retry: false },
    },
  })
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    children: [
      {
        index: true,
        lazy: () => import('@/pages/dashboard').then((m) => ({ Component: m.DashboardPage })),
      },
      {
        path: 'projects',
        lazy: () => import('@/pages/projects').then((m) => ({ Component: m.ProjectsPage })),
      },
      {
        path: 'projects/:projectId',
        lazy: () =>
          import('@/pages/project-detail').then((m) => ({ Component: m.ProjectDetailPage })),
      },
      {
        path: '*',
        lazy: () => import('@/pages/not-found').then((m) => ({ Component: m.NotFoundPage })),
      },
    ],
  },
]
