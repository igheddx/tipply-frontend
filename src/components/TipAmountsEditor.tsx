import React, { useEffect, useState } from 'react'
import { Button } from './ui'
import { BrandIcon } from './icons/BrandIcons'
import { ALLOWED_TIP_AMOUNTS, DEFAULT_TIP_AMOUNTS, LIGHT_EFFECTS, TIP_AMOUNT_COUNT, validateTipAmounts } from '../utils/deviceConfig'

interface TipAmountsEditorProps {
  amounts: number[]
  saving: boolean
  onSave: (amounts: number[]) => void
  onReset: () => void
  /** Drawn without its own card and heading, to sit inside another card (the performer's "tip buttons" card) */
  bare?: boolean
}

const sorted = (values: number[]) => [...values].sort((a, b) => a - b)

// Picks the six amounts shown on a performer's tip page, from a fixed list. They are always shown smallest to largest.
const TipAmountsEditor: React.FC<TipAmountsEditorProps> = ({ amounts, saving, onSave, onReset, bare = false }) => {
  const [draft, setDraft] = useState<number[]>(sorted(amounts))

  useEffect(() => setDraft(sorted(amounts)), [amounts])

  const toggle = (amount: number) =>
    setDraft(prev => (prev.includes(amount) ? prev.filter(a => a !== amount) : sorted([...prev, amount])))

  const error = validateTipAmounts(draft)
  const unchanged = draft.length === amounts.length && draft.every((value, i) => value === sorted(amounts)[i])
  const full = draft.length >= TIP_AMOUNT_COUNT

  return (
    <div className={bare ? '' : 'rounded-2xl border border-slate-100 bg-white p-5 shadow-card'}>
      {!bare && <h3 className="text-base font-bold text-ink-900">Tip amounts</h3>}
      <p className={`mb-3 text-sm text-ink-500 ${bare ? '' : 'mt-0.5'}`}>
        Pick the {TIP_AMOUNT_COUNT} amounts shown on the tip page. They are shown lowest to highest, and each position keeps its light
        effect ({LIGHT_EFFECTS.map(effect => effect.label).join(', ')}, from left to right).
        Default: {DEFAULT_TIP_AMOUNTS.map(a => `$${a}`).join(', ')}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tip amounts to offer">
        {/* an amount chosen before the list was limited stays visible so the performer can swap it out */}
        {sorted(Array.from(new Set([...ALLOWED_TIP_AMOUNTS, ...draft]))).map(amount => {
          const selected = draft.includes(amount)
          return (
            <button
              key={amount}
              type="button"
              aria-pressed={selected}
              disabled={saving || (!selected && full)}
              onClick={() => toggle(amount)}
              className={`inline-flex h-11 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-bold transition-colors disabled:opacity-60 ${
                selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-ink-500 hover:bg-slate-50'
              }`}
            >
              {selected && <BrandIcon name="check" size={16} tone="inverse" strokeWidth={2.4} />}
              ${amount}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-sm text-ink-700" aria-live="polite">
        {draft.length} of {TIP_AMOUNT_COUNT} picked{draft.length > 0 ? `: ${draft.map(a => `$${a}`).join(', ')}` : ''}
      </p>
      {error && !unchanged && draft.length === TIP_AMOUNT_COUNT && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => onSave(draft)} loading={saving} disabled={!!error || unchanged}>
          Save amounts
        </Button>
        <Button variant="secondary" onClick={onReset} disabled={saving}>Reset to defaults</Button>
      </div>
    </div>
  )
}

export default TipAmountsEditor
