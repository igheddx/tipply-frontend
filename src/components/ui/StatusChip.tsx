import { BrandIcon, type BrandIconName } from '../icons/BrandIcons'

export type ChipKind =
  | 'active'
  | 'paused'
  | 'offline'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'info'

const KINDS: Record<ChipKind, { label: string; icon: BrandIconName; bg: string; fg: string }> = {
  active: { label: 'Active', icon: 'active', bg: 'var(--chip-active-bg)', fg: 'var(--chip-active-fg)' },
  paused: { label: 'Paused', icon: 'pause', bg: 'var(--chip-paused-bg)', fg: 'var(--chip-paused-fg)' },
  offline: { label: 'Offline', icon: 'offline', bg: 'var(--chip-offline-bg)', fg: 'var(--chip-offline-fg)' },
  processing: { label: 'Processing', icon: 'clock', bg: 'var(--chip-paused-bg)', fg: 'var(--chip-paused-fg)' },
  paid: { label: 'Paid', icon: 'check-circle', bg: 'var(--chip-paid-bg)', fg: 'var(--chip-paid-fg)' },
  failed: { label: 'Failed', icon: 'error', bg: 'var(--chip-failed-bg)', fg: 'var(--chip-failed-fg)' },
  info: { label: 'Info', icon: 'info', bg: 'var(--chip-active-bg)', fg: 'var(--chip-active-fg)' }
}

/** Status is always an icon plus a word, never color alone. */
export function StatusChip({ kind, label }: { kind: ChipKind; label?: string }) {
  const k = KINDS[kind]
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-2 pr-2.5 text-xs font-semibold"
      style={{ background: k.bg, color: k.fg }}
    >
      <BrandIcon name={k.icon} size={15} tone="current" strokeWidth={1.9} />
      {label ?? k.label}
    </span>
  )
}
