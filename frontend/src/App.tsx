import { RouterProvider, createBrowserRouter } from 'react-router'
import { AppProviders } from '@/app/root-layout'
import { createQueryClient, routes } from '@/app/routes'

const queryClient = createQueryClient()
const router = createBrowserRouter(routes)

export function App() {
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
