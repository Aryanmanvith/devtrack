import { createContext, useContext, type ReactNode } from 'react'
import type { DataRouter } from 'react-router'

const RouterInstanceContext = createContext<DataRouter | null>(null)

/**
 * Makes the router instance available to hooks that write the URL. Its `state.location` is
 * the URL as of the latest navigation, while `useSearchParams()` returns the URL of the last
 * render. React Router applies navigations in a transition, so the two can differ for a moment.
 */
export function RouterInstanceProvider({
  router,
  children,
}: {
  router: DataRouter
  children: ReactNode
}) {
  return <RouterInstanceContext value={router}>{children}</RouterInstanceContext>
}

export function useRouterInstance() {
  const router = useContext(RouterInstanceContext)
  if (!router) throw new Error('useRouterInstance must be used inside <RouterInstanceProvider>')
  return router
}
