import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../ui'
import { repeatApi, type RepeatStats } from '../../services/repeatApi'
import { cohortFor, cohortText, daysText, percent } from '../../utils/repeat'

const weekLabel = (iso: string) => {
  const d = new Date(iso)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

/** Platform-wide repeat tippers for the admin overview: the headline, the 7 / 30 / 90 day windows, and new versus returning by week. */
export function AdminRepeat({ refreshKey }: { refreshKey?: string | number }) {
  const [stats, setStats] = useState<RepeatStats | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void repeatApi.admin().then(res => {
      if (cancelled) return
      if (res.data) setStats(res.data)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (!loaded) return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
  if (!stats) return null

  const back = daysText(stats.medianDaysToReturn)
  const weeks = stats.weekly.map(w => ({ week: weekLabel(w.weekStart), New: w.newTippers, Returning: w.returningTippers }))

  return (
    <Card title="Repeat tippers" subtitle="People who came back on another night. A new night starts after four quiet hours.">
      {stats.tippers === 0 ? (
        <p className="text-sm text-ink-700">Nothing to measure yet.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="text-4xl font-bold text-ink-900" data-testid="admin-repeat-rate">
              {percent(stats.returningTippers, stats.tippers)}
            </div>
            <div className="text-sm text-ink-500">
              {stats.returningTippers} of {stats.tippers} tippers have come back
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-ink-700">
              {[7, 30, 90].map(days => {
                const text = cohortText(cohortFor(stats.cohorts, days))
                return (
                  <li key={days}>
                    Back within {days} days: <strong className="text-ink-900">{text ?? 'too early to tell'}</strong>
                  </li>
                )
              })}
              <li>
                Active in the last 30 days: <strong className="text-ink-900">{stats.activeTippers}</strong>
                {stats.activeTippers > 0 ? `, ${percent(stats.activeReturningTippers, stats.activeTippers)} returning` : ''}
              </li>
              <li>
                Tipped more than once (any night): <strong className="text-ink-900">{percent(stats.multiTipTippers, stats.tippers)}</strong>
              </li>
              <li>
                Regulars (three nights or more): <strong className="text-ink-900">{stats.regulars}</strong>
              </li>
              {stats.totalTipAmount > 0 && (
                <li>
                  Tip money from returning tippers: <strong className="text-ink-900">{percent(stats.returningTipAmount, stats.totalTipAmount)}</strong>
                </li>
              )}
              {back && stats.returningTippers > 0 && (
                <li>
                  Typical time to come back: <strong className="text-ink-900">{back}</strong>
                </li>
              )}
            </ul>
            <p className="mt-3 text-xs text-ink-500">People are counted by their browser, so the true repeat rate is at least this high.</p>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold text-ink-900">New and returning tippers by week</div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={weeks} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip cursor={{ fill: 'rgba(8,145,166,0.08)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="New" stackId="a" fill="#52C2D2" isAnimationActive={false} />
                  <Bar dataKey="Returning" stackId="a" fill="#0E7490" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
