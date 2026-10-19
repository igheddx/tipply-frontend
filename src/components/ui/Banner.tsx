import type { ReactNode } from 'react'
import { BrandIcon, type BrandIconName } from '../icons/BrandIcons'

export type BannerTone = 'success' | 'info' | 'warning' | 'error'

const TONES: Record<BannerTone, { icon: BrandIconName; color: string; bg: string; border: string }> = {
  success: { icon: 'check-circle', color: 'var(--tone-success-fg)', bg: 'var(--tone-success-bg)', border: 'var(--tone-success-border)' },
  info: { icon: 'info', color: 'var(--tone-info-fg)', bg: 'var(--tone-info-bg)', border: 'var(--tone-info-border)' },
  warning: { icon: 'warning', color: 'var(--tone-warning-fg)', bg: 'var(--tone-warning-bg)', border: 'var(--tone-warning-border)' },
  error: { icon: 'error', color: 'var(--tone-error-fg)', bg: 'var(--tone-error-bg)', border: 'var(--tone-error-border)' }
}

interface BannerProps {
  tone?: BannerTone
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  onDismiss?: () => void
  className?: string
}

/** A message bar: soft tinted background, icon in a white tile, optional action and dismiss. */
export function Banner({ tone = 'info', title, children, action, onDismiss, className = '' }: BannerProps) {
  const t = TONES[tone]
  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${className}`}
      style={{ background: t.bg, borderColor: t.border }}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: t.color }}>
        <BrandIcon name={t.icon} size={20} tone="current" strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-bold" style={{ color: t.color }}>
          {title}
        </div>
        {children && <div className="mt-0.5 text-ink-700">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-white/70"
        >
          <BrandIcon name="close" size={16} color="#64748B" />
        </button>
      )}
    </div>
  )
}
