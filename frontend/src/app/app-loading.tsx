import { LogoMark } from '@/components/common/logo'

/** Shown for a moment on first load while the first page's code is fetched. */
export function AppLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" role="status">
      <div className="flex flex-col items-center gap-3">
        <LogoMark className="size-9 animate-pulse" />
        <span className="text-[13px] text-subtle">Loading DevTrack…</span>
      </div>
    </div>
  )
}
