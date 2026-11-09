import { APP_VERSION } from '../../utils/appVersion'
import { useEffect, useState } from 'react'
import { Button } from '../ui'
import { Modal } from '../ui/Modal'
import { useFeedback } from '../ui/Feedback'
import { DEFAULT_REFUND_REASONS, REFUND_WINDOW_DAYS, refundRequestApi } from '../../services/refundRequestApi'

/** A tip a refund can be asked for. Give the tip's id, or the song request's id when the tip is only known through its request. */
export interface RefundableTip {
  tipId?: string
  songRequestId?: string
  amount: number
  createdAt: string
}

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

interface Props {
  open: boolean
  /** The tip to ask about; with more than one the performer picks which */
  tips: RefundableTip[]
  onClose: () => void
  /** Called after the request was sent, so the screen can show it as requested */
  onRequested: () => void
}

/**
 * A performer asks for one of their tips to be refunded. Tipwave reviews every request: it is not a refund by itself, and the
 * dialog says so plainly. If it is approved the tipper is refunded and the performer is told.
 */
export function RefundRequestDialog({ open, tips, onClose, onRequested }: Props) {
  const { toast } = useFeedback()
  const [pick, setPick] = useState(0)
  const [reason, setReason] = useState('mistake')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPick(0)
    setReason('mistake')
    setNote('')
    setError(null)
  }, [open])

  const tip = tips[pick]

  const send = async () => {
    if (!tip) return
    setSending(true)
    setError(null)
    const res = await refundRequestApi.create({
      ...(tip.tipId ? { tipId: tip.tipId } : { songRequestId: tip.songRequestId }),
      reason,
      note: note.trim() || undefined,
      appVersion: APP_VERSION
    })
    setSending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    toast('Refund request sent. We will review it and let you know.', 'success')
    onRequested()
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Ask for a refund"
      onClose={onClose}
      footer={
        <>
          <Button size="lg" block loading={sending} disabled={!tip} onClick={send}>
            Send request
          </Button>
          <Button size="lg" block variant="ghost" onClick={onClose}>
            Not now
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-700">
        Tipwave reviews every request. If it is approved, the tipper is refunded and you will get an email. Tips from the last {REFUND_WINDOW_DAYS} days can be requested.
      </p>

      {tips.length > 1 ? (
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-ink-700">Which tip?</legend>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {tips.map((t, i) => (
              <li key={`${t.tipId ?? t.songRequestId}-${i}`}>
                <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-4 text-sm text-ink-900">
                  <input type="radio" name="refund-tip" checked={pick === i} onChange={() => setPick(i)} />
                  <span className="flex-1">{when(t.createdAt)}</span>
                  <span className="font-semibold">{money(t.amount)}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : (
        tip && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <span className="text-sm text-ink-700">Tip from {when(tip.createdAt)}</span>
            <span className="text-lg font-bold text-ink-900">{money(tip.amount)}</span>
          </div>
        )
      )}

      <div className="mt-4">
        <div className="mb-2 text-sm font-semibold text-ink-700">Why?</div>
        <div role="radiogroup" aria-label="Reason" className="flex flex-wrap gap-2">
          {DEFAULT_REFUND_REASONS.map(r => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={reason === r.key}
              onClick={() => setReason(r.key)}
              className={`min-h-[40px] rounded-full border px-3.5 text-sm font-semibold ${reason === r.key ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-ink-700'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 block text-sm font-semibold text-ink-700" htmlFor="refund-note">
        Anything we should know? (optional)
      </label>
      <textarea
        id="refund-note"
        value={note}
        maxLength={300}
        rows={3}
        onChange={e => setNote(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-ink-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </Modal>
  )
}
