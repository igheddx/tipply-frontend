import type { PlatformKey, PlatformMix, PlatformRow } from '../../services/platformMixApi'
import { percent } from '../../utils/repeat'

const LABELS: Record<PlatformKey, string> = {
  ios: 'iPhone / iPad',
  android: 'Android',
  desktop: 'Computer',
  unknown: 'Not recorded'
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`
const sum = (rows: PlatformRow[], pick: (r: PlatformRow) => number) => rows.reduce((total, r) => total + pick(r), 0)

/**
 * The numbers behind the Phones card, for the whole platform or for one show: iPhone / iPad, Android and everything else side by side,
 * how they pay (Apple or Google Pay versus a typed-in card, tip by tip), whether a wallet was available, and a table with a row for each phone.
 * It only draws what it is given. `scope` finishes the sentence "Showing N tippers ...", for example "in this show".
 */
export function PlatformMixView({ mix, scope }: { mix: PlatformMix; scope: string }) {
  const row = (key: PlatformKey): PlatformRow =>
    mix.rows.find(r => r.key === key) ?? { key, tippers: 0, tips: 0, totalAmount: 0, walletTippers: 0, walletTips: 0, walletAmount: 0, songRequesters: 0, songRequests: 0 }
  const ios = row('ios')
  const android = row('android')
  const otherTippers = sum([row('desktop'), row('unknown')], r => r.tippers)
  const groups = [
    { name: 'iPhone / iPad', tippers: ios.tippers, bar: 'bg-brand-700', testId: 'phones-ios' },
    { name: 'Android', tippers: android.tippers, bar: 'bg-emerald-500', testId: 'phones-android' },
    { name: 'Other', tippers: otherTippers, bar: 'bg-slate-300', testId: 'phones-other' }
  ]

  const wallet = mix.wallet
  const card = mix.card
  const payTips = (wallet?.tips ?? 0) + (card?.tips ?? 0)
  const ways =
    wallet && card
      ? [
          { name: 'Apple / Google Pay', way: wallet, bar: 'bg-brand-700', testId: 'pay-wallet' },
          { name: 'Card typed in', way: card, bar: 'bg-slate-400', testId: 'pay-card' }
        ]
      : []
  const estimated = mix.estimatedTips ?? 0
  const reach = mix.walletReach

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {groups.map(g => (
          <div key={g.name} data-testid={g.testId}>
            <div className="text-3xl font-bold text-ink-900">{percent(g.tippers, mix.tippers)}</div>
            <div className="text-sm font-semibold text-ink-900">{g.name}</div>
            <div className="text-xs text-ink-700">{plural(g.tippers, 'tipper')}</div>
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
                  {plural(w.way.tips, 'tip')} · {plural(w.way.tippers, 'tipper')} · {money(w.way.totalAmount)}
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
          <p className="text-xs text-ink-700" data-testid="pay-note">
            {estimated > 0
              ? `Share of tips. ${plural(estimated, 'tip')} of ${payTips.toLocaleString()} ${estimated === 1 ? 'was' : 'were'} made before each tip recorded how it was paid, so ${estimated === 1 ? 'it counts' : 'they count'} under the way that tipper pays now. A tipper who used both ways is counted under each.`
              : 'Share of tips, counted tip by tip. A tipper who used both ways is counted under each.'}
          </p>
        </div>
      )}

      {reach && (
        <div data-testid="wallet-reach" className="space-y-1 border-t border-slate-100 pt-5">
          <h3 className="text-sm font-bold text-ink-900">Could they have used Apple Pay or Google Pay?</h3>
          {reach.known === 0 ? (
            <p className="text-sm text-ink-700">Not recorded yet. It fills in as people save a payment.</p>
          ) : (
            <>
              <p className="text-sm text-ink-900">
                <strong>{percent(reach.available, reach.known)}</strong> of {plural(reach.known, 'checked phone')} had one available ({reach.available.toLocaleString()}).
              </p>
              {reach.available > 0 && (
                <p className="text-sm text-ink-900">
                  Of those, <strong>{percent(reach.usedWallet, reach.available)}</strong> use it ({reach.usedWallet.toLocaleString()}) and{' '}
                  <strong data-testid="reach-typed">{percent(reach.typedCardInstead, reach.available)}</strong> typed a card instead ({reach.typedCardInstead.toLocaleString()}).
                </p>
              )}
              <p className="text-xs text-ink-700">Only people whose phone was checked are counted. It is recorded when someone saves a payment.</p>
            </>
          )}
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
                        {r.walletTippers} of {plural(r.tippers, 'tipper')}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-ink-900">
                    {r.tippers > 0 ? `${r.songRequesters} (${percent(r.songRequesters, r.tippers)})` : '–'}
                    {r.songRequests > 0 && <span className="block text-xs text-ink-700">{plural(r.songRequests, 'request')}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-700">
        “Other” is a computer plus anyone whose phone was never recorded. iPhone / iPad count together. Showing {plural(mix.tippers, 'tipper')} {scope}.
      </p>
    </div>
  )
}
