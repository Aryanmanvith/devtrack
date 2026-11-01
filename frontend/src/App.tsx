import { RouterProvider, createBrowserRouter } from 'react-router'
import { AppProviders } from '@/app/root-layout'
import { createQueryClient, routes } from '@/app/routes'
import { RouterInstanceProvider } from '@/providers/router-instance'

const queryClient = createQueryClient()
const router = createBrowserRouter(routes)

export function App() {
  return (
    <AppProviders queryClient={queryClient}>
      <RouterInstanceProvider router={router}>
        <RouterProvider router={router} />
      </RouterInstanceProvider>
    </AppProviders>
  )
}
