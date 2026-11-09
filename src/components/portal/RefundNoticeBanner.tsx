import { useCallback, useEffect, useState } from 'react'
import { Banner } from '../ui/Banner'
import { Button } from '../ui'
import { refundNoticeApi, type RefundNotice } from '../../services/refundNoticeApi'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

/**
 * Tells a performer that a tip was refunded to the tipper. Viewing it (the button) opens the Tips list and
 * clears the message for good, so it is shown once.
 */
export function RefundNoticeBanner({ onView, tab = 'overview' }: { onView: () => void; tab?: string }) {
  const [notices, setNotices] = useState<RefundNotice[]>([])

  const load = useCallback(async () => {
    try {
      const list = await refundNoticeApi.forPerformer()
      setNotices(list.notices)
    } catch {
      setNotices([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Opening the Tips list is seeing it: the message has done its job and does not follow the performer around
  useEffect(() => {
    if (tab !== 'tips' || notices.length === 0) return
    const ids = notices.map(n => n.id)
    setNotices([])
    void refundNoticeApi.performerSeen(ids)
  }, [tab, notices])

  // Shown on Home only, never above the page title of every other tab
  if (notices.length === 0 || tab !== 'overview') return null

  const total = notices.reduce((sum, n) => sum + n.amount, 0)
  const dismiss = () => {
    const ids = notices.map(n => n.id)
    setNotices([])
    void refundNoticeApi.performerSeen(ids)
  }
  const view = () => {
    dismiss()
    onView()
  }

  return (
    <Banner
      tone="info"
      className="mb-3 last:mb-0"
      onDismiss={dismiss}
      title={notices.length === 1 ? `A ${money(total)} tip was refunded` : `${notices.length} tips (${money(total)}) were refunded`}
      action={
        <Button size="sm" variant="secondary" onClick={view}>
          See your tips
        </Button>
      }
    >
      Sometimes a tip is sent by mistake, and we make it right with the tipper. {notices.length === 1 ? 'It no longer counts' : 'They no longer count'} in your totals and {notices.length === 1 ? 'stays' : 'stay'} in your Tips list marked Refunded.
    </Banner>
  )
}
