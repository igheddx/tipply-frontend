import { BrandIcon } from '../icons/BrandIcons'
import { useTheme, type ThemePreference } from '../../theme/ThemeContext'

const OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Auto' }
]

/** Three-way choice: Light, Dark, or Auto (follow the device). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme()
  return (
    <div role="radiogroup" aria-label="Color theme" className={`flex rounded-xl bg-slate-100 p-1 ${className}`}>
      {OPTIONS.map(o => {
        const on = o.id === preference
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={on}
            onClick={() => setPreference(o.id)}
            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              on ? 'bg-white text-brand-800 shadow-card' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            {o.id === 'light' && <BrandIcon name="sun" size={14} tone="current" />}
            {o.id === 'dark' && <BrandIcon name="moon" size={14} tone="current" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** One-tap switch between light and dark, for tight spaces such as a phone's top bar. */
export function ThemeQuickToggle() {
  const { resolved, setPreference } = useTheme()
  const dark = resolved === 'dark'
  return (
    <button
      onClick={() => setPreference(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100"
    >
      <BrandIcon name={dark ? 'sun' : 'moon'} size={22} />
    </button>
  )
}
