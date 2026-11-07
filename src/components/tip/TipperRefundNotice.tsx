import { useEffect, useState } from 'react'
import { Button } from '../ui'
import { Modal } from '../ui/Modal'
import { BrandIcon } from '../icons/BrandIcons'
import { refundNoticeApi, type RefundNotice } from '../../services/refundNoticeApi'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

/**
 * Tells a tipper, once, that a tip of theirs was refunded. It appears the next time they open Tipwave on this phone
 * and goes away for good when they tap Got it. Calm and plain: no offers, no prompts to tip again.
 */
export function TipperRefundNotice({ userId }: { userId?: string }) {
  const [notices, setNotices] = useState<RefundNotice[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void refundNoticeApi.forTipper(userId).then(list => {
      if (cancelled || list.notices.length === 0) return
      setNotices(list.notices)
      setOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!open || notices.length === 0 || !userId) return null

  const total = notices.reduce((sum, n) => sum + n.amount, 0)
  const names = Array.from(new Set(notices.map(n => n.performerName).filter(Boolean))) as string[]
  const single = notices.length === 1
  const to = names.length === 1 ? ` to ${names[0]}` : ''

  const gotIt = () => {
    setOpen(false)
    void refundNoticeApi.tipperSeen(userId, notices.map(n => n.id))
  }

  return (
    <Modal
      open
      title="Your refund is on its way"
      hideClose
      // Escape or a tap outside only hides it for now; it comes back next visit so it is never missed
      onClose={() => setOpen(false)}
      footer={
        <Button size="lg" block onClick={gotIt}>
          Got it
        </Button>
      }
    >
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50">
          <BrandIcon name="check-circle" size={30} tone="brand" strokeWidth={1.8} />
        </span>
        <p className="text-4xl font-bold text-ink-900">{money(total)}</p>
      </div>
      <p className="mt-4 text-base text-ink-700">
        {single
          ? `Your tip${to} was refunded to your card on ${day(notices[0].refundedAt)}.`
          : `Your ${notices.length} tips${to} were refunded to your card.`}
      </p>
      {!single && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {notices.map(n => (
            <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-ink-700">
              <span>
                {day(n.refundedAt)}
                {names.length > 1 && n.performerName ? ` · ${n.performerName}` : ''}
              </span>
              <span className="font-semibold text-ink-900">{money(n.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-ink-500">
        Refunds usually reach your card within 5 to 10 business days, depending on your bank. You do not need to do anything.
      </p>
    </Modal>
  )
}
