import { BrandIcon, type BrandIconName } from '../icons/BrandIcons'

export type ChipKind =
  | 'active'
  | 'paused'
  | 'offline'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'info'

const KINDS: Record<ChipKind, { label: string; icon: BrandIconName; bg: string; fg: string; icon_color: string }> = {
  active: { label: 'Active', icon: 'active', bg: '#E6F6F9', fg: '#0E7490', icon_color: '#0891A6' },
  paused: { label: 'Paused', icon: 'pause', bg: '#FFF7E6', fg: '#B45309', icon_color: '#B45309' },
  offline: { label: 'Offline', icon: 'offline', bg: '#F1F5F9', fg: '#64748B', icon_color: '#94A3B8' },
  processing: { label: 'Processing', icon: 'clock', bg: '#FFF7E6', fg: '#B45309', icon_color: '#B45309' },
  paid: { label: 'Paid', icon: 'check-circle', bg: '#ECFDF3', fg: '#15803D', icon_color: '#15803D' },
  failed: { label: 'Failed', icon: 'error', bg: '#FEF2F2', fg: '#DC2626', icon_color: '#DC2626' },
  info: { label: 'Info', icon: 'info', bg: '#E6F6F9', fg: '#0E7490', icon_color: '#0891A6' }
}

/** Status is always an icon plus a word, never color alone. */
export function StatusChip({ kind, label }: { kind: ChipKind; label?: string }) {
  const k = KINDS[kind]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 text-xs font-semibold"
      style={{ background: k.bg, color: k.fg }}
    >
      <BrandIcon name={k.icon} size={15} color={k.icon_color} strokeWidth={1.9} />
      {label ?? k.label}
    </span>
  )
}
