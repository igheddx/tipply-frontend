import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  preference: ThemePreference
  /** What is actually showing: the preference, or the device setting when the preference is "system" */
  resolved: ResolvedTheme
  setPreference: (p: ThemePreference) => void
  /** True while a portal, admin or monitor screen is on show; the dark theme only applies there */
  inPortal: boolean
  registerPortal: () => () => void
}

const STORAGE_KEY = 'tipwave_theme'

const readPreference = (): ThemePreference => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

const systemPrefersDark = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  resolved: 'light',
  setPreference: () => undefined,
  inPortal: false,
  registerPortal: () => () => undefined
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  const [portalCount, setPortalCount] = useState(0)

  // Follow the device setting while the preference is "system"
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    try {
      localStorage.setItem(STORAGE_KEY, p)
    } catch {
      /* the choice just will not be remembered */
    }
  }, [])

  const registerPortal = useCallback(() => {
    setPortalCount(c => c + 1)
    return () => setPortalCount(c => Math.max(0, c - 1))
  }, [])

  const inPortal = portalCount > 0

  // Page background and scrollbars follow the theme only inside the portal
  useEffect(() => {
    const dark = inPortal && resolved === 'dark'
    const root = document.documentElement
    root.classList.toggle('theme-dark', dark)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#0a1c27' : '#0E7490')
  }, [inPortal, resolved])

  const value = useMemo(
    () => ({ preference, resolved, setPreference, inPortal, registerPortal }),
    [preference, resolved, setPreference, inPortal, registerPortal]
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

/** Call from a portal, admin or monitor screen: switches the dark theme on for as long as it is mounted. */
export function usePortalTheme(): { dark: boolean; className: string } {
  const { resolved, registerPortal } = useTheme()
  useEffect(() => registerPortal(), [registerPortal])
  const dark = resolved === 'dark'
  return { dark, className: dark ? 'portal-dark' : '' }
}
