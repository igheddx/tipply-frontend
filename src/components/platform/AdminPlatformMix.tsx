import { useEffect, useState } from 'react'
import { Card } from '../ui'
import { platformMixApi, type PlatformMix } from '../../services/platformMixApi'
import { PlatformMixView } from './PlatformMixView'

const WINDOWS: { days: number; label: string }[] = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' }
]

/**
 * The phones the people who tip use, and how they pay, for the whole platform: iPhone / iPad, Android and everything else side by side.
 * A tipper's phone is recorded when they save a card or wallet. Counts only, nobody named. (The same numbers for one show: ShowPlatformMix.)
 */
export function AdminPlatformMix({ refreshKey }: { refreshKey?: string | number }) {
  const [days, setDays] = useState(30)
  const [mix, setMix] = useState<PlatformMix | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    void platformMixApi.admin(days).then(res => {
      if (cancelled) return
      setMix(res.data && Array.isArray(res.data.rows) ? (res.data as PlatformMix) : null)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [days, refreshKey])

  const windows = (
    <div role="group" aria-label="Time period" className="flex flex-wrap gap-1.5">
      {WINDOWS.map(w => (
        <button
          key={w.days}
          type="button"
          aria-pressed={days === w.days}
          onClick={() => setDays(w.days)}
          className={`h-8 rounded-full px-3 text-xs font-bold ${days === w.days ? 'bg-brand-700 text-white' : 'bg-slate-100 text-ink-700 hover:bg-slate-200'}`}
        >
          {w.label}
        </button>
      ))}
    </div>
  )

  const subtitle = 'Which phones the people who tip use, and how they pay. A tipper’s phone is recorded when they save a card or wallet.'

  if (!loaded) {
    return (
      <Card title="Phones" subtitle={subtitle} actions={windows}>
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
      </Card>
    )
  }
  if (!mix) {
    return (
      <Card title="Phones" subtitle={subtitle} actions={windows}>
        <p className="text-sm text-ink-700">The numbers could not be loaded. Try again in a moment.</p>
      </Card>
    )
  }

  return (
    <Card title="Phones" subtitle={subtitle} actions={windows}>
      {mix.tippers === 0 ? (
        <p className="text-sm text-ink-700">Nobody has tipped in this period.</p>
      ) : (
        <PlatformMixView mix={mix} scope={mix.days > 0 ? `who tipped in the last ${mix.days} days` : 'in all'} />
      )}
    </Card>
  )
}
