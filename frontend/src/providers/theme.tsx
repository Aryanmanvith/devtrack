import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useUpdatePreferences } from '@/hooks/mutations'
import { usePreferences } from '@/hooks/queries'
import { useMediaQuery } from '@/hooks/use-utils'
import type { Theme } from '@/lib/api/types'

interface ThemeValue {
  theme: Theme
  resolved: 'dark' | 'light'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)
const STORAGE_KEY = 'devtrack-theme'

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'system' ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

/**
 * The theme preference is stored in the backend (so it survives reloads and new browsers)
 * and mirrored to localStorage so index.html can apply it before the first paint.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preferences = usePreferences()
  const { mutate } = useUpdatePreferences()
  const [initial] = useState(readStoredTheme)
  const theme = preferences.data?.theme ?? initial
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.classList.toggle('light', resolved === 'light')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#17181c' : '#f3f4f6')
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Ignore unavailable storage; the server copy still persists the choice.
    }
  }, [theme, resolved])

  const setTheme = useCallback(
    (next: Theme) => mutate({ changes: { theme: next }, success: false }),
    [mutate],
  )
  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
