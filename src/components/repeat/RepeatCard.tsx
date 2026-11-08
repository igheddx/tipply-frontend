import { useEffect, useState } from 'react'
import { Card } from '../ui'
import { repeatApi, type RepeatStats } from '../../services/repeatApi'
import { cohortFor, cohortText, daysText, percent } from '../../utils/repeat'

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

/**
 * On the performer's home screen: how many of the people who tip them come back. Counts only; tippers stay anonymous.
 * People are counted by the browser they tip from, so the real number is at least what is shown here.
 */
export function RepeatCard({ refreshKey }: { refreshKey?: string | number }) {
  const [stats, setStats] = useState<RepeatStats | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void repeatApi.mine().then(res => {
      if (cancelled) return
      if (res.data) setStats(res.data)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (!loaded) return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
  if (!stats) return null

  const within30 = cohortText(cohortFor(stats.cohorts, 30))
  const within7 = cohortText(cohortFor(stats.cohorts, 7))
  const back = daysText(stats.medianDaysToReturn)

  return (
    <Card title="Your regulars" subtitle="People who come back to tip you on another night">
      {stats.tippers === 0 ? (
        <p className="text-sm text-ink-700">Your regulars appear here once people start tipping you.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <div className="text-4xl font-bold text-ink-900" data-testid="repeat-rate">
                {percent(stats.returningTippers, stats.tippers)}
              </div>
              <div className="text-sm text-ink-500">of your tippers have come back</div>
            </div>
            <div className="text-sm text-ink-700">
              {stats.returningTippers === 0
                ? `${plural(stats.tippers, 'person')} has tipped you so far.`
                : `${stats.returningTippers} of ${plural(stats.tippers, 'tipper')} tipped on more than one night.`}
            </div>
          </div>

          <ul className="mt-4 space-y-1.5 text-sm text-ink-700">
            {within7 && <li>Back within a week: <strong className="text-ink-900">{within7}</strong></li>}
            {within30 && <li>Back within a month: <strong className="text-ink-900">{within30}</strong></li>}
            {stats.regulars > 0 && <li>Regulars (three nights or more): <strong className="text-ink-900">{stats.regulars}</strong></li>}
            {back && stats.returningTippers > 0 && <li>People usually come back after about <strong className="text-ink-900">{back}</strong>.</li>}
            {stats.totalTipAmount > 0 && stats.returningTipAmount > 0 && (
              <li>
                Tips from people who came back: <strong className="text-ink-900">{percent(stats.returningTipAmount, stats.totalTipAmount)}</strong> of the total
              </li>
            )}
          </ul>
          {stats.returningTippers === 0 && <p className="mt-3 text-sm text-ink-500">Nobody has come back yet. It takes a few shows for regulars to show up.</p>}
          <p className="mt-3 text-xs text-ink-500">Tippers are counted by the phone browser they use, so the real number is at least this high.</p>
        </>
      )}
    </Card>
  )
}
