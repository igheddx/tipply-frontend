import React from 'react'
import { StatusChip, type ChipKind } from './ui/StatusChip'

export interface PayoutSummary {
  status: string
  amount: number
  createdUtc: string
  arrivalUtc?: string | null
  failureCode?: string | null
}

interface PayoutsCardProps {
  futurePayouts: number
  availableToPayOut?: number | null
  inTransit: number
  recentPayouts?: PayoutSummary[] | null
  now?: Date
}

const money = (n: number) => `$${n.toFixed(2)}`
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const STATUS: Record<string, { kind: ChipKind; label: string }> = {
  paid: { kind: 'paid', label: 'Paid' },
  in_transit: { kind: 'processing', label: 'In transit' },
  pending: { kind: 'processing', label: 'Pending' },
  failed: { kind: 'failed', label: 'Failed' },
  canceled: { kind: 'offline', label: 'Canceled' },
}

/**
 * Where a performer's money is, in the order it moves: coming from Stripe (pending), then ready to pay out (available), then a payout that is on its way
 * (In transit), then paid. Read from Stripe; nothing here can move money.
 */
const PayoutsCard: React.FC<PayoutsCardProps> = ({ futurePayouts, availableToPayOut, inTransit, recentPayouts, now = new Date() }) => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <h3 className="text-lg font-semibold text-ink-900">Where the money is</h3>
    <p className="mt-1 text-sm text-ink-500">
      Money moves from pending, to available, to a payout on its way to the bank, to paid. Payouts are created in Stripe; available money stays put until one is.
    </p>

    <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <dt className="text-sm text-ink-500">1. Coming from Stripe</dt>
        <dd className="text-xl font-bold text-ink-900">{money(futurePayouts)}</dd>
        <dd className="text-xs text-ink-400">Held by Stripe for a few days</dd>
      </div>
      <div>
        <dt className="text-sm text-ink-500">2. Ready to pay out</dt>
        <dd className="text-xl font-bold text-ink-900">{availableToPayOut == null ? 'Not available' : money(availableToPayOut)}</dd>
        <dd className="text-xs text-ink-400">Ready for the next payout</dd>
      </div>
      <div>
        <dt className="text-sm text-ink-500">3. On its way to the bank</dt>
        <dd className="text-xl font-bold text-ink-900">{money(inTransit)}</dd>
        <dd className="text-xs text-ink-400">On its way to the bank</dd>
      </div>
    </dl>

    <h4 className="mt-5 text-sm font-semibold text-ink-900">Latest payouts</h4>
    {recentPayouts == null ? (
      <p className="mt-1 text-sm text-ink-500">Payout details could not be read from Stripe just now.</p>
    ) : recentPayouts.length === 0 ? (
      <p className="mt-1 text-sm text-ink-500">No payouts yet. Nothing has been sent to this performer's bank.</p>
    ) : (
      <ul className="mt-2 divide-y divide-slate-100">
        {recentPayouts.map((payout, i) => {
          const chip = STATUS[payout.status] ?? { kind: 'offline' as ChipKind, label: payout.status }
          const open = payout.status === 'in_transit' || payout.status === 'pending'
          const late = open && !!payout.arrivalUtc && new Date(payout.arrivalUtc).getTime() < now.getTime() - 24 * 3600 * 1000
          return (
            <li key={`${payout.createdUtc}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-ink-900">{money(payout.amount)}</span>
                <StatusChip kind={chip.kind} label={chip.label} />
              </div>
              <div className="text-sm text-ink-500">
                {payout.arrivalUtc ? `${open ? 'Expected' : payout.status === 'paid' ? 'Arrived' : 'Due'} ${day(payout.arrivalUtc)}` : `Created ${day(payout.createdUtc)}`}
                {late && <span className="ml-2 font-semibold text-amber-700">Past its date: check Stripe</span>}
                {payout.status === 'failed' && payout.failureCode && <span className="ml-2 font-semibold text-red-600">{payout.failureCode.replace(/_/g, ' ')}</span>}
              </div>
            </li>
          )
        })}
      </ul>
    )}
  </div>
)

export default PayoutsCard
