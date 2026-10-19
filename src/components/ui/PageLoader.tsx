import { useTheme } from '../../theme/ThemeContext'

interface PageLoaderProps {
  label?: string
  /** Follow the dark theme. Portal screens do; onboarding and login stay light. */
  themed?: boolean
}

/** A full-page loading state: the Tipwave monogram, gently pulsing. */
export function PageLoader({ label = 'Loading…', themed = true }: PageLoaderProps) {
  const { resolved } = useTheme()
  const dark = themed && resolved === 'dark'
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex min-h-screen flex-col items-center justify-center ${dark ? 'portal-dark bg-surface' : 'bg-surface'}`}
    >
      <img src="/images/logo/tipwave-monogram.png" alt="" className="h-12 w-auto animate-pulse" />
      <p className="mt-4 text-sm text-ink-500">{label}</p>
    </div>
  )
}
