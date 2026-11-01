import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'
import { useRouterInstance } from '@/providers/router-instance'

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

type ParamChanges = Record<string, string | number | null | undefined>

/**
 * Apply changes to the URL as it is now, not as it was when the calling component last
 * rendered. `setSearchParams(fn)` hands `fn` the params of the last render, so an update that
 * runs late (a debounced search, a callback after a request) used to write back filters the
 * user had removed in the meantime.
 */
function useSearchParamsWriter() {
  const router = useRouterInstance()
  return useCallback(
    (changes: ParamChanges, replace: boolean) => {
      const { pathname, search } = router.state.location
      const updated = new URLSearchParams(search)
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === '') updated.delete(key)
        else updated.set(key, String(value))
      }
      const query = updated.toString()
      void router.navigate({ pathname, search: query ? `?${query}` : '' }, { replace })
    },
    [router],
  )
}

/**
 * Read and write a single URL search parameter (used for ?task= and ?issue= drawers),
 * leaving every other parameter, such as list filters, untouched.
 */
export function useSearchParamState(key: string) {
  const [params] = useSearchParams()
  const write = useSearchParamsWriter()
  const value = params.get(key)
  const set = useCallback(
    (next: string | number | null, options: { replace?: boolean } = {}) =>
      write({ [key]: next }, options.replace ?? false),
    [key, write],
  )
  return [value, set] as const
}

/** Update several search params at once; null or '' removes a key. */
export function useUpdateSearchParams() {
  const write = useSearchParamsWriter()
  return useCallback((changes: ParamChanges, replace = true) => write(changes, replace), [write])
}

export function useLocalStorageFlag(key: string, initial: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored === null ? initial : stored === 'true'
    } catch {
      return initial
    }
  })
  const update = useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, String(next))
      } catch {
        // Storage can be unavailable (private mode); the setting then lasts for this visit.
      }
    },
    [key],
  )
  return [value, update] as const
}

/** Ctrl+K / ⌘K opens the palette from anywhere. */
export function useCommandShortcut(toggle: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
}
