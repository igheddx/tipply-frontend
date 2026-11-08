import { useEffect, useState } from 'react'
import { Button } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { tipperApi, type TipperDetails } from '../../services/tipperApi'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const brandName = (b?: string | null) => (b ? b.charAt(0).toUpperCase() + b.slice(1).replace('_', ' ') : 'Card')
const walletName = (w?: string | null) => (w === 'apple_pay' ? 'Apple Pay' : w === 'google_pay' ? 'Google Pay' : w ? w.replace('_', ' ') : null)

interface Props {
  tipId: string
  /** Lets the admin jump to every tip from this tipper */
  onShowAllTips?: (details: TipperDetails) => void
}

/**
 * Who gave a tip, as one block for the admin: our ids, the card, and the email when Stripe has one
 * (only for Apple Pay and Google Pay). Read live from Stripe when this opens; nothing here is saved.
 */
export function AdminTipperBlock({ tipId, onShowAllTips }: Props) {
  const { toast } = useFeedback()
  const [details, setDetails] = useState<TipperDetails | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDetails(null)
    setFailed(false)
    void tipperApi.details(tipId).then(res => {
      if (cancelled) return
      if (res.error || !res.data) setFailed(true)
      else setDetails(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [tipId])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied', 'success')
    } catch {
      toast('Could not copy. Select the text instead.', 'error')
    }
  }

  if (failed) return <p className="text-sm text-ink-500">Could not load who gave this tip.</p>
  if (!details) return <div className="h-16 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />

  const wallet = walletName(details.wallet)
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm" aria-label="Who gave this tip">
      <dl className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="w-20 shrink-0 text-ink-500">Email</dt>
          <dd className="text-ink-900">{details.email ?? <span className="text-ink-500">None. Paid with a typed card.</span>}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="w-20 shrink-0 text-ink-500">Card</dt>
          <dd className="text-ink-900">
            {details.cardLast4 ? `${brandName(details.cardBrand)} ···· ${details.cardLast4}${wallet ? ` · ${wallet}` : ''}` : <span className="text-ink-500">Not available</span>}
          </dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="w-20 shrink-0 text-ink-500">Tipper id</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2 text-ink-900">
            <code className="break-all text-xs">{details.userId}</code>
            <button type="button" className="text-xs font-semibold text-brand-700 underline" onClick={() => copy(details.userId)}>
              Copy
            </button>
          </dd>
        </div>
        {details.browserId && (
          <div className="flex flex-wrap items-center gap-2">
            <dt className="w-20 shrink-0 text-ink-500">Browser id</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-2 text-ink-900">
              <code className="break-all text-xs">{details.browserId}</code>
              <button type="button" className="text-xs font-semibold text-brand-700 underline" onClick={() => copy(details.browserId!)}>
                Copy
              </button>
            </dd>
          </div>
        )}
      </dl>

      {details.stripeStatus === 'unavailable' && <p className="mt-2 text-xs text-ink-500">Stripe’s details could not be read just now. The ids above are still right.</p>}
      {details.stripeStatus === 'mode_mismatch' && <p className="mt-2 text-xs text-ink-500">This tip was paid in the other Stripe mode, so its card details are not shown here.</p>}
      {details.stripeStatus === 'no_payment_method' && <p className="mt-2 text-xs text-ink-500">No card is recorded for this tip.</p>}

      {details.otherTips.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-ink-700">Other tips from this tipper to this performer</div>
          <ul className="mt-1 space-y-0.5" aria-label="Other tips from this tipper">
            {details.otherTips.map(t => (
              <li key={t.tipId} className="flex justify-between gap-3 text-xs text-ink-700">
                <span>{when(t.createdAt)}</span>
                <span className="font-semibold">
                  {money(t.amount)}
                  {t.status !== 'processed' ? ` · ${t.status}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onShowAllTips && (
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => onShowAllTips(details)}>
            Show all tips from this tipper
          </Button>
        </div>
      )}
    </div>
  )
}
