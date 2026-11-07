import { useCallback, useEffect, useState } from 'react'
import { Banner } from '../ui/Banner'
import { Button } from '../ui'
import { refundNoticeApi, type RefundNotice } from '../../services/refundNoticeApi'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

/**
 * Tells a performer that a tip was refunded to the tipper. Viewing it (the button) opens the Tips list and
 * clears the message for good, so it is shown once.
 */
export function RefundNoticeBanner({ onView }: { onView: () => void }) {
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

  if (notices.length === 0) return null

  const total = notices.reduce((sum, n) => sum + n.amount, 0)
  const view = () => {
    const ids = notices.map(n => n.id)
    setNotices([])
    void refundNoticeApi.performerSeen(ids)
    onView()
  }

  return (
    <Banner
      tone="info"
      className="mb-3 last:mb-0"
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
