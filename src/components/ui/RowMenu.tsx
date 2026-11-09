import { useEffect, useId, useRef, useState } from 'react'
import { BrandIcon } from '../icons/BrandIcons'

export interface RowMenuItem {
  key: string
  label: string
  onSelect: () => void
  /** The full spoken name, when the label alone would be ambiguous in a list of rows */
  ariaLabel?: string
  /** "danger" is red, for things that remove something */
  tone?: 'default' | 'danger'
  disabled?: boolean
}

/**
 * A "..." button that opens a small menu. For the rare actions on a row, so the row itself stays calm:
 * the menu closes on a choice, an outside click or Escape.
 */
export function RowMenu({ label, items, className = '' }: { label: string; items: RowMenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={root} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink-500 hover:bg-slate-100 hover:text-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <BrandIcon name="more" size={20} tone="current" />
      </button>
      {open && (
        <div id={menuId} role="menu" className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              aria-label={item.ariaLabel}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={`flex h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold disabled:opacity-50 ${
                item.tone === 'danger' ? 'text-red-700 hover:bg-red-50' : 'text-ink-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
