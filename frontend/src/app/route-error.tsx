import { RotateCcw } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { LogoMark } from '@/components/common/logo'
import { Button } from '@/components/ui/button'

/** Shown if a page crashes while rendering or fails to load its code. */
export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto size-10" />
        <h1 className="mt-6 text-[22px] font-semibold font-display text-foreground">
          This page hit an error
        </h1>
        <p className="mt-2 text-[13.5px] text-muted">
          Reloading usually fixes it. If it keeps happening, check the browser console and the
          backend terminal.
        </p>
        <p className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-left text-[12.5px] break-words text-subtle">
          {message}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RotateCcw aria-hidden />
            Reload page
          </Button>
          <Button asChild>
            <Link to="/">Go to overview</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
