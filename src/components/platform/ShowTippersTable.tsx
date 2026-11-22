import type { PlatformKey, PlatformMix, ShowTipper } from '../../services/platformMixApi'

const PHONE: Record<PlatformKey, string> = {
  ios: 'iPhone / iPad',
  android: 'Android',
  desktop: 'Computer',
  unknown: 'Not recorded'
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })

const paidWith = (t: ShowTipper) => {
  const label = t.walletTips > 0 && t.cardTips > 0 ? 'Both' : t.walletTips > 0 ? 'Apple / Google Pay' : 'Card'
  return t.estimatedTips > 0 ? `${label} (estimated)` : label
}

/**
 * Every phone that tipped in one show, one row each, in the order they first tipped. It is there so the tipper count can be checked rather than
 * trusted: the rows add up to the show's tips and dollars, and each phone is one customer in Stripe. Phones are numbered, never identified.
 */
export function ShowTippersTable({ mix }: { mix: PlatformMix }) {
  const list = mix.tipperList
  if (!list || list.length === 0) return null

  const tips = list.reduce((n, t) => n + t.tips, 0)
  const total = list.reduce((n, t) => n + t.totalAmount, 0)
  const names = mix.requestNames ?? 0

  return (
    <div data-testid="show-tippers" className="space-y-3 border-t border-slate-100 pt-5">
      <div>
        <h3 className="text-sm font-bold text-ink-900">Tippers in this show</h3>
        <p className="text-xs text-ink-700">
          One row for each phone, in the order they first tipped. The rows add up to this show’s tips and total, and each phone is one customer in Stripe.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-wide text-ink-700">
              <th className="py-2 pr-3">Phone</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3 text-right">Tips</th>
              <th className="py-2 pr-3 text-right">Tipped</th>
              <th className="py-2 pr-3">First tip</th>
              <th className="py-2 pr-3">Last tip</th>
              <th className="py-2 pr-3">Paid with</th>
              <th className="py-2 pr-3 text-right">Song requests</th>
              <th className="py-2">Names on requests</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(t => (
              <tr key={t.number} data-testid={`show-tipper-${t.number}`}>
                <td className="py-2 pr-3 font-semibold text-ink-900">Phone {t.number}</td>
                <td className="py-2 pr-3 text-ink-900">{PHONE[t.phone] ?? PHONE.unknown}</td>
                <td className="py-2 pr-3 text-right text-ink-900">{t.tips.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-ink-900">{money(t.totalAmount)}</td>
                <td className="py-2 pr-3 text-ink-900">{when(t.firstTipAt)}</td>
                <td className="py-2 pr-3 text-ink-900">{when(t.lastTipAt)}</td>
                <td className="py-2 pr-3 text-ink-900">{paidWith(t)}</td>
                <td className="py-2 pr-3 text-right text-ink-900">{t.songRequests.toLocaleString()}</td>
                <td className="py-2 text-ink-900">{t.names.length > 0 ? t.names.join(', ') : '–'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-bold text-ink-900" data-testid="show-tippers-total">
              <td className="py-2 pr-3" colSpan={2}>
                {plural(list.length, 'phone')}
              </td>
              <td className="py-2 pr-3 text-right">{tips.toLocaleString()}</td>
              <td className="py-2 pr-3 text-right">{money(total)}</td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-ink-700" data-testid="names-note">
        {names === 0
          ? 'No names were typed on this show’s song requests.'
          : names > list.length
            ? `${plural(names, 'different name')} were typed on song requests, more than the ${plural(list.length, 'phone')} that tipped, so some phones were shared by more than one person.`
            : `${plural(names, 'different name')} ${names === 1 ? 'was' : 'were'} typed on song requests, across ${plural(list.length, 'phone')}.`}
      </p>
    </div>
  )
}
