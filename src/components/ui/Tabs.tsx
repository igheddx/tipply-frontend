import type { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  /** A small count shown beside the label */
  count?: number
  icon?: ReactNode
}

interface TabsProps {
  items: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}

/** A segmented control for switching between a few views of the same page. */
export function Tabs({ items, active, onChange, className = '' }: TabsProps) {
  return (
    <div role="tablist" className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 ${className}`}>
      {items.map(item => {
        const on = item.id === active
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(item.id)}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              on ? 'bg-white text-brand-800 shadow-card' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${on ? 'bg-brand-50 text-brand-800' : 'bg-slate-200 text-ink-500'}`}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
