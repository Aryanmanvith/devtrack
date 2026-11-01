import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'

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

/**
 * Read and write a single URL search parameter (used for ?task= and ?issue= drawers),
 * leaving every other parameter, such as list filters, untouched.
 */
export function useSearchParamState(key: string) {
  const [params, setParams] = useSearchParams()
  const value = params.get(key)
  const set = useCallback(
    (next: string | number | null, options: { replace?: boolean } = {}) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          if (next === null || next === '') updated.delete(key)
          else updated.set(key, String(next))
          return updated
        },
        { replace: options.replace ?? false },
      )
    },
    [key, setParams],
  )
  return [value, set] as const
}

/** Update several search params at once; null or '' removes a key. */
export function useUpdateSearchParams() {
  const [, setParams] = useSearchParams()
  return useCallback(
    (changes: Record<string, string | number | null | undefined>, replace = true) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === undefined || value === '') updated.delete(key)
            else updated.set(key, String(value))
          }
          return updated
        },
        { replace },
      )
    },
    [setParams],
  )
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
