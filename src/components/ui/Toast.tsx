import { BrandIcon, type BrandIconName } from '../icons/BrandIcons'

export type ToastTone = 'success' | 'error' | 'info'

const ICONS: Record<ToastTone, { icon: BrandIconName; color: string }> = {
  success: { icon: 'check-circle', color: '#4ADE80' },
  error: { icon: 'error', color: '#F87171' },
  info: { icon: 'info', color: '#7EE3EF' }
}

interface ToastProps {
  tone?: ToastTone
  message: string
  onDismiss?: () => void
}

/** A short message: a dark pill at the top of the screen. In the dark theme it is lifted and outlined (see .toast-pill in index.css) so it stands out from the page. */
export function Toast({ tone = 'info', message, onDismiss }: ToastProps) {
  const t = ICONS[tone]
  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-pill fixed inset-x-4 top-4 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-ink-900 px-4 py-3 text-white shadow-lift"
    >
      <BrandIcon name={t.icon} size={22} color={t.color} />
      <span className="min-w-0 flex-1 text-sm font-semibold">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
          <BrandIcon name="close" size={16} color="#CBD5E1" />
        </button>
      )}
    </div>
  )
}
