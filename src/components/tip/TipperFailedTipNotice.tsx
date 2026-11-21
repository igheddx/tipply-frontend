import { useEffect, useState } from 'react'
import { Button } from '../ui'
import { BrandIcon } from '../icons/BrandIcons'
import { failedTipNoticeApi, type FailedTipNotice } from '../../services/failedTipNoticeApi'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

/**
 * Tells a tipper, once, that a saved-card tip of theirs could not be charged. It is found when they next open the tip page on
 * this phone. It is marked as seen the moment it is shown, so it never comes back, even if they do nothing with it. The server
 * does not offer a failure older than a week. Calm and plain: no blame, and it never blocks tapping an amount.
 */
export function TipperFailedTipNotice({ userId, onChangeCard }: { userId?: string; onChangeCard: () => void }) {
  const [notices, setNotices] = useState<FailedTipNotice[]>([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void failedTipNoticeApi.forTipper(userId).then(list => {
      if (cancelled || list.notices.length === 0) return
      setNotices(list.notices)
      void failedTipNoticeApi.tipperSeen(userId, list.notices.map(n => n.id)) // shown once: never again
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (notices.length === 0) return null

  const total = notices.reduce((sum, n) => sum + n.amount, 0)
  const names = Array.from(new Set(notices.map(n => n.performerName).filter(Boolean))) as string[]
  const to = names.length === 1 ? ` to ${names[0]}` : ''
  const message =
    notices.length === 1
      ? `Your ${money(notices[0].amount)} tip${to} on ${day(notices[0].failedAt)} didn't go through, so they weren't paid. Your card couldn't be charged.`
      : `Your ${notices.length} tips${to} (${money(total)} in all) didn't go through, so they weren't paid. Your card couldn't be charged.`

  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-pill fixed inset-x-4 top-4 z-[65] mx-auto max-w-md rounded-2xl border border-white/15 bg-ink-900 p-4 text-white shadow-lift"
    >
      <div className="flex items-start gap-3">
        <BrandIcon name="info" size={22} color="#7EE3EF" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">A tip didn't go through</p>
          <p className="mt-1 text-white/95">{message} You're welcome to add a different card and tip again.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setNotices([])
                onChangeCard()
              }}
            >
              Use a different card
            </Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setNotices([])}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
