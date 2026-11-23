import { useRef, useState, type ReactNode } from 'react'
import { Button, Modal } from '../ui'
import { payoutApi, type WithdrawalPreview } from '../../services/payoutApi'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const TRY_AGAIN = 'Your balance could not be read just now. Please try again in a moment.'

/** One key for one confirmation. It is reused if that same confirmation is retried, so the server can never send the money twice. */
const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

type View =
  | { kind: 'closed' }
  | { kind: 'loading' }
  | { kind: 'preview'; preview: WithdrawalPreview }
  | { kind: 'sending'; preview: WithdrawalPreview }
  | { kind: 'sent'; amount: number; bankLast4?: string | null; arrivalUtc?: string | null }
  | { kind: 'changed'; amount: number }
  | { kind: 'error'; message: string; preview?: WithdrawalPreview }

const arrivalDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : null)

/**
 * Sends a performer's available balance to their bank. Nothing is sent until they confirm the exact amount. Standard payout only (no fee), to the
 * bank on their own Stripe account, for the whole balance that is ready. The server checks everything again and refuses if the balance changed.
 */
export function WithdrawMoney({ onWithdrawn }: { onWithdrawn?: () => void }) {
  const [view, setView] = useState<View>({ kind: 'closed' })
  const key = useRef<string>('')
  const sending = useRef(false) // set at once on the tap, before the screen has re-drawn, so a fast double tap cannot send twice

  const load = async () => {
    setView({ kind: 'loading' })
    key.current = newKey() // a new look at the balance is a new confirmation
    try {
      const res = await payoutApi.withdrawalPreview()
      const preview = res.data as WithdrawalPreview | undefined
      setView(preview && typeof preview.status === 'string' ? { kind: 'preview', preview } : { kind: 'error', message: res.error || TRY_AGAIN })
    } catch {
      setView({ kind: 'error', message: TRY_AGAIN })
    }
  }

  const close = () => {
    if (sending.current) return
    setView({ kind: 'closed' })
  }

  const confirm = async (preview: WithdrawalPreview) => {
    if (sending.current) return
    sending.current = true
    setView({ kind: 'sending', preview })
    try {
      const res = await payoutApi.withdraw(preview.available, key.current)
      if (res.status === 409 && res.raw?.code === 'balance_changed') {
        setView({ kind: 'changed', amount: Number(res.raw.amount) || 0 })
      } else if (res.data && res.data.status === 'created') {
        setView({ kind: 'sent', amount: Number(res.data.amount), bankLast4: preview.bankLast4, arrivalUtc: res.data.arrivalUtc })
        onWithdrawn?.()
      } else {
        // Nothing was sent. The same key stays, so trying again can never send twice.
        setView({ kind: 'error', message: res.error || TRY_AGAIN, preview })
      }
    } catch {
      setView({ kind: 'error', message: TRY_AGAIN, preview })
    } finally {
      sending.current = false
    }
  }

  const open = view.kind !== 'closed'
  const busy = view.kind === 'sending'

  let body: ReactNode = null
  let footer: ReactNode = null

  if (view.kind === 'loading') {
    body = <div className="h-20 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
  } else if (view.kind === 'preview' || view.kind === 'sending') {
    const p = view.preview
    if (p.status === 'ready') {
      body = (
        <div className="space-y-3 text-sm text-ink-700">
          <p className="text-ink-900">
            You can withdraw <strong className="text-2xl">{money(p.available)}</strong>
          </p>
          <p>
            It will be sent to {p.bankName ? `${p.bankName} ` : 'your bank account '}ending <strong>{p.bankLast4}</strong>. It usually arrives in 1 to 4 business days. There is no fee.
          </p>
          {p.pending > 0 && <p>{money(p.pending)} more is still coming from Stripe. It will be ready to withdraw in a few days.</p>}
        </div>
      )
      footer = (
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void confirm(p)}>
            Withdraw {money(p.available)}
          </Button>
        </>
      )
    } else {
      const reasons: Record<string, string> = {
        nothing_available: 'There is nothing ready to withdraw yet.',
        automatic: 'Your payouts are automatic: Stripe sends your money to your bank for you. If you would rather withdraw by hand, choose manual in Manage payouts.',
        no_bank: 'Add a bank account in your Stripe dashboard first (Manage payouts), then you can withdraw.',
        not_ready: 'Finish setting up payouts first, then you can withdraw.',
        unavailable: TRY_AGAIN
      }
      body = (
        <div className="space-y-3 text-sm text-ink-700">
          <p className="text-ink-900">{reasons[p.status] ?? TRY_AGAIN}</p>
          {p.status === 'nothing_available' && p.pending > 0 && <p>{money(p.pending)} is on its way from Stripe and will be ready in a few days.</p>}
        </div>
      )
      footer = p.status === 'unavailable' ? (
        <>
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
          <Button onClick={() => void load()}>Try again</Button>
        </>
      ) : (
        <Button onClick={close}>Close</Button>
      )
    }
  } else if (view.kind === 'sent') {
    const day = arrivalDay(view.arrivalUtc)
    body = (
      <div className="space-y-3 text-sm text-ink-700">
        <p className="text-ink-900">
          <strong>{money(view.amount)}</strong> is on its way to your bank{view.bankLast4 ? ` account ending ${view.bankLast4}` : ''}.
        </p>
        <p>It usually arrives in 1 to 4 business days{day ? `, around ${day}` : ''}. You can follow it in Manage payouts.</p>
      </div>
    )
    footer = <Button onClick={close}>Done</Button>
  } else if (view.kind === 'changed') {
    body = (
      <p className="text-sm text-ink-900">
        Your balance changed, so nothing was sent. You can now withdraw <strong>{money(view.amount)}</strong>.
      </p>
    )
    footer = (
      <>
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button onClick={() => void load()}>Review</Button>
      </>
    )
  } else if (view.kind === 'error') {
    body = <p className="text-sm text-ink-900">{view.message}</p>
    footer = (
      <>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
        <Button onClick={() => (view.preview ? void confirm(view.preview) : void load())}>Try again</Button>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-ink-700">Send the money that is ready to your bank.</p>
        <Button size="sm" variant="secondary" icon="transit" onClick={() => void load()}>
          Withdraw
        </Button>
      </div>
      <Modal open={open} title="Withdraw to your bank" onClose={close} hideClose={busy} footer={footer}>
        {body}
      </Modal>
    </>
  )
}
