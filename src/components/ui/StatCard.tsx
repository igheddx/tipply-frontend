import type { ReactNode } from 'react'
import { BrandIcon, type BrandIconName } from '../icons/BrandIcons'

export type StatCardVariant = 'tile' | 'inline' | 'row'

interface StatCardProps {
  label: string
  value: ReactNode
  caption?: ReactNode
  icon: BrandIconName
  /** tile: soft icon tile (desktop). inline: icon beside the label. row: compact list row (phones). */
  variant?: StatCardVariant
}

const CARD = 'rounded-2xl border border-slate-100 bg-white p-4 shadow-card'

export function StatCard({ label, value, caption, icon, variant = 'tile' }: StatCardProps) {
  if (variant === 'row') {
    return (
      <div className="flex items-center gap-3 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
          <BrandIcon name={icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink-900">{label}</div>
          {caption && <div className="truncate text-xs text-ink-400">{caption}</div>}
        </div>
        <div className="text-base font-bold text-ink-900">{value}</div>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={CARD}>
        <div className="flex items-center gap-2">
          <BrandIcon name={icon} size={18} />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</span>
        </div>
        <div className="mt-2 text-2xl font-bold text-ink-900">{value}</div>
        {caption && <div className="mt-0.5 text-xs text-ink-400">{caption}</div>}
      </div>
    )
  }

  return (
    <div className={CARD}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
        <BrandIcon name={icon} size={22} />
      </span>
      <div className="mt-3 text-sm text-ink-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink-900">{value}</div>
      {caption && <div className="mt-0.5 text-xs text-ink-400">{caption}</div>}
    </div>
  )
}
