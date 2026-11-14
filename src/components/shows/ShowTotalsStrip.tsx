import { useEffect, useState } from 'react'
import { showApi, type ShowSummary } from '../../services/showApi'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

interface Props {
  /** Whether Live is open: nothing is asked while it is closed */
  active: boolean
  /** A show the performer picked from the list (its totals come from the list); null means the current show */
  picked?: ShowSummary | null
  /** How often to ask again, in ms */
  refreshMs?: number
}

/**
 * The night's running total on the Live screen: what the performer keeps, how many tips, and the amount tipped before fees.
 * It follows the current show and updates as tips arrive. Left out when shows are off or there is no show yet, and never asked for
 * on someone else's screen (the caller does not render it there).
 */
export function ShowTotalsStrip({ active, picked = null, refreshMs = 5000 }: Props) {
  const [current, setCurrent] = useState<ShowSummary | null>(null)

  useEffect(() => {
    if (!active || picked) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await showApi.current()
        // keep the last numbers on a failed refresh: a blip should not blank the total
        if (!cancelled && res.data) setCurrent(res.data as ShowSummary)
      } catch {
        /* the strip simply keeps what it had */
      }
    }
    void load()
    const timer = window.setInterval(load, refreshMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [active, picked, refreshMs])

  const show = picked ?? current
  if (!show) return null

  return (
    <section aria-label="Show totals" className="flex flex-none flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-slate-200 bg-white px-4 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">{show.isLive ? 'Tonight' : 'This show'}</span>
      <span className="text-2xl font-extrabold text-ink-900" aria-label={`You keep ${money(show.youKeep)}`}>
        {money(show.youKeep)}
        <span className="ml-1 text-xs font-semibold text-ink-500">you keep</span>
      </span>
      <span className="text-sm font-semibold text-ink-700">
        {show.tipCount} {show.tipCount === 1 ? 'tip' : 'tips'}
      </span>
      <span className="text-sm text-ink-500">{money(show.gross)} tipped</span>
      {show.waitingGross > 0 && <span className="text-sm text-ink-500">{money(show.waitingGross)} not charged yet</span>}
    </section>
  )
}
