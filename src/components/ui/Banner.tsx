import type { ReactNode } from 'react'
import { BrandIcon, type BrandIconName } from '../icons/BrandIcons'

export type BannerTone = 'success' | 'info' | 'warning' | 'error'

const TONES: Record<BannerTone, { icon: BrandIconName; color: string; bg: string; border: string }> = {
  success: { icon: 'check-circle', color: '#15803D', bg: '#ECFDF3', border: '#BBF7D0' },
  info: { icon: 'info', color: '#0E7490', bg: '#E6F6F9', border: '#B6E4EC' },
  warning: { icon: 'warning', color: '#B45309', bg: '#FFF7E6', border: '#FDE3A7' },
  error: { icon: 'error', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
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
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
        <BrandIcon name={t.icon} size={20} color={t.color} strokeWidth={1.7} />
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
