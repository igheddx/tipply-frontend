import { useEffect, useState } from 'react'
import { Button } from '../ui'
import { Modal } from '../ui/Modal'
import { showApi } from '../../services/showApi'

interface Props {
  open: boolean
  current: string | null
  onPick: (venueName: string | null) => void
  onClose: () => void
}

/** Choose where a show was played: one tap on a recent venue, or type a new one. Always optional. */
export function VenuePicker({ open, current, onPick, onClose }: Props) {
  const [venues, setVenues] = useState<string[]>([])
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) return
    setTyped('')
    let cancelled = false
    void showApi.venues().then(res => {
      if (!cancelled) setVenues(Array.isArray(res.data?.venues) ? res.data.venues : [])
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const query = typed.trim().toLowerCase()
  const shown = query ? venues.filter(v => v.toLowerCase().includes(query)) : venues
  const exact = venues.some(v => v.toLowerCase() === query)

  return (
    <Modal open={open} title="Where are you playing?" onClose={onClose}>
      <label className="block text-sm font-semibold text-ink-700" htmlFor="venue-typed">
        Search or add a place
      </label>
      <input
        id="venue-typed"
        value={typed}
        maxLength={100}
        onChange={e => setTyped(e.target.value)}
        placeholder="Joe's Bar"
        className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-ink-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {query && !exact && (
        <Button className="mt-3" block onClick={() => onPick(typed.trim())}>
          Add “{typed.trim()}”
        </Button>
      )}
      {shown.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {shown.map(v => (
            <li key={v}>
              <button
                type="button"
                onClick={() => onPick(v)}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 text-left text-base text-ink-900 hover:bg-slate-50"
              >
                <span className="truncate">{v}</span>
                {v === current && <span className="text-xs font-semibold text-brand-700">Current</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {current && (
        <button type="button" onClick={() => onPick(null)} className="mt-4 text-sm font-semibold text-ink-500 underline">
          Remove the place
        </button>
      )}
    </Modal>
  )
}
