import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { TooltipProvider } from '@/components/ui/menu'
import { DialogsProvider } from '@/providers/dialogs'
import { ThemeProvider } from '@/providers/theme'

export function AppProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient
  children: ReactNode
}) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export function RootLayout() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        <DialogsProvider>
          <AppShell />
        </DialogsProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
