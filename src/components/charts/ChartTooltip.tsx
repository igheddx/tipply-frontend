import type { ReactNode } from 'react'

interface ChartTooltipProps {
  active?: boolean
  label?: ReactNode
  rows: { label: string; value: string }[]
}

/** The tooltip card shared by all charts: Tipwave card styling, readable in light and dark. */
export function ChartTooltip({ active, label, rows }: ChartTooltipProps) {
  if (!active) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lift">
      {label && <div className="mb-1 text-xs font-semibold text-ink-500">{label}</div>}
      {rows.map(r => (
        <div key={r.label} className="flex items-baseline justify-between gap-6 text-sm">
          <span className="text-ink-500">{r.label}</span>
          <span className="font-bold text-ink-900">{r.value}</span>
        </div>
      ))}
    </div>
  )
}
