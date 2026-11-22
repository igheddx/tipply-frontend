import { useEffect, useState } from 'react'
import { Card } from '../ui'
import { platformMixApi, type PlatformKey, type PlatformMix, type PlatformRow } from '../../services/platformMixApi'
import { percent } from '../../utils/repeat'

const WINDOWS: { days: number; label: string }[] = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' }
]

const LABELS: Record<PlatformKey, string> = {
  ios: 'iPhone / iPad',
  android: 'Android',
  desktop: 'Computer',
  unknown: 'Not recorded'
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const sum = (rows: PlatformRow[], pick: (r: PlatformRow) => number) => rows.reduce((total, r) => total + pick(r), 0)

/**
 * The phones the people who tip use, side by side: iPhone / iPad, Android, and everything else (a computer, or a phone that was never recorded).
 * A tipper's phone is recorded when they save a card or wallet. Counts only, nobody named.
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

  const subtitle = 'Which phones the people who tip use. A tipper’s phone is recorded when they save a card or wallet.'

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

  const row = (key: PlatformKey): PlatformRow =>
    mix.rows.find(r => r.key === key) ?? { key, tippers: 0, tips: 0, totalAmount: 0, walletTippers: 0, walletTips: 0, walletAmount: 0, songRequesters: 0, songRequests: 0 }
  const ios = row('ios')
  const android = row('android')
  const others = [row('desktop'), row('unknown')]
  const otherTippers = sum(others, r => r.tippers)
  const wallet = mix.wallet
  const card = mix.card
  const payTips = (wallet?.tips ?? 0) + (card?.tips ?? 0)
  const ways = wallet && card
    ? [
        { name: 'Apple / Google Pay', way: wallet, bar: 'bg-brand-700', testId: 'pay-wallet' },
        { name: 'Card typed in', way: card, bar: 'bg-slate-400', testId: 'pay-card' }
      ]
    : []
  const groups = [
    { name: 'iPhone / iPad', tippers: ios.tippers, bar: 'bg-brand-700', testId: 'phones-ios' },
    { name: 'Android', tippers: android.tippers, bar: 'bg-emerald-500', testId: 'phones-android' },
    { name: 'Other', tippers: otherTippers, bar: 'bg-slate-300', testId: 'phones-other' }
  ]

  return (
    <Card title="Phones" subtitle={subtitle} actions={windows}>
      {mix.tippers === 0 ? (
        <p className="text-sm text-ink-700">Nobody has tipped in this period.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {groups.map(g => (
              <div key={g.name} data-testid={g.testId}>
                <div className="text-3xl font-bold text-ink-900">{percent(g.tippers, mix.tippers)}</div>
                <div className="text-sm font-semibold text-ink-900">{g.name}</div>
                <div className="text-xs text-ink-700">
                  {g.tippers.toLocaleString()} {g.tippers === 1 ? 'tipper' : 'tippers'}
                </div>
              </div>
            ))}
          </div>

          <div role="img" aria-label="Share of tippers by phone" className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {groups.map(g => (
              <div key={g.name} className={g.bar} style={{ width: `${(g.tippers / mix.tippers) * 100}%` }} title={`${g.name}: ${g.tippers}`} />
            ))}
          </div>

          {ways.length > 0 && (
            <div data-testid="how-they-pay" className="space-y-3 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-ink-900">How they pay</h3>
              <div className="grid grid-cols-2 gap-3">
                {ways.map(w => (
                  <div key={w.name} data-testid={w.testId}>
                    <div className="text-3xl font-bold text-ink-900">{percent(w.way.tips, payTips)}</div>
                    <div className="text-sm font-semibold text-ink-900">{w.name}</div>
                    <div className="text-xs text-ink-700">
                      {w.way.tips.toLocaleString()} {w.way.tips === 1 ? 'tip' : 'tips'} · {w.way.tippers.toLocaleString()} {w.way.tippers === 1 ? 'tipper' : 'tippers'} · {money(w.way.totalAmount)}
                    </div>
                  </div>
                ))}
              </div>
              {payTips > 0 && (
                <div role="img" aria-label="Share of tips by way of paying" className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  {ways.map(w => (
                    <div key={w.name} className={w.bar} style={{ width: `${(w.way.tips / payTips) * 100}%` }} title={`${w.name}: ${w.way.tips}`} />
                  ))}
                </div>
              )}
              <p className="text-xs text-ink-700">
                Share of tips. The app saves how a person pays, not how each tip was paid, so all of a tipper’s tips count under the way they paid most recently.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-ink-700">
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3 text-right">Tippers</th>
                  <th className="py-2 pr-3 text-right">Share</th>
                  <th className="py-2 pr-3 text-right">Tips</th>
                  <th className="py-2 pr-3 text-right">Tipped</th>
                  <th className="py-2 pr-3 text-right">Average tip</th>
                  <th className="py-2 pr-3 text-right">Apple / Google Pay (share of tips)</th>
                  <th className="py-2 text-right">Asked for a song</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(['ios', 'android', 'desktop', 'unknown'] as PlatformKey[]).map(key => {
                  const r = row(key)
                  return (
                    <tr key={key} data-testid={`phones-row-${key}`}>
                      <td className="py-2 pr-3 font-semibold text-ink-900">{LABELS[key]}</td>
                      <td className="py-2 pr-3 text-right text-ink-900">{r.tippers.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-right text-ink-900">{percent(r.tippers, mix.tippers)}</td>
                      <td className="py-2 pr-3 text-right text-ink-900">{r.tips.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-right text-ink-900">{money(r.totalAmount)}</td>
                      <td className="py-2 pr-3 text-right text-ink-900">{r.tips > 0 ? money(r.totalAmount / r.tips) : '–'}</td>
                      <td className="py-2 pr-3 text-right text-ink-900">
                        {r.tips > 0 ? percent(r.walletTips, r.tips) : '–'}
                        {r.tippers > 0 && (
                          <span className="block text-xs text-ink-700">
                            {r.walletTippers} of {r.tippers} {r.tippers === 1 ? 'tipper' : 'tippers'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right text-ink-900">
                        {r.tippers > 0 ? `${r.songRequesters} (${percent(r.songRequesters, r.tippers)})` : '–'}
                        {r.songRequests > 0 && (
                          <span className="block text-xs text-ink-700">
                            {r.songRequests.toLocaleString()} {r.songRequests === 1 ? 'request' : 'requests'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-ink-700">
            “Other” is a computer plus anyone whose phone was never recorded. iPhone / iPad count together. Showing {mix.tippers.toLocaleString()}{' '}
            {mix.tippers === 1 ? 'tipper' : 'tippers'}
            {mix.days > 0 ? ` who tipped in the last ${mix.days} days` : ' in all'}.
          </p>
        </div>
      )}
    </Card>
  )
}
