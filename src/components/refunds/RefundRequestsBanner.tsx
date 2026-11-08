import { useCallback, useEffect, useState } from 'react'
import { Banner } from '../ui/Banner'
import { Button } from '../ui'
import { refundRequestApi, type RefundRequest } from '../../services/refundRequestApi'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * On the performer's home screen: refund requests that are waiting for Tipwave, and one that was not approved (shown once).
 * A waiting request goes away on its own once it has been processed; an approved one is covered by the "refund processed" notice.
 */
export function RefundRequestsBanner({ refreshKey }: { refreshKey?: string | number }) {
  const [requests, setRequests] = useState<RefundRequest[]>([])

  const load = useCallback(async () => {
    const res = await refundRequestApi.mine()
    setRequests(Array.isArray(res.data?.requests) ? res.data.requests : [])
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  if (requests.length === 0) return null

  const waiting = requests.filter(r => r.status === 'pending')
  const declined = requests.filter(r => r.status === 'declined')

  const dismiss = (ids: string[]) => {
    setRequests(prev => prev.filter(r => !ids.includes(r.id)))
    void refundRequestApi.mineSeen(ids)
  }

  return (
    <div className="space-y-3">
      {waiting.length > 0 && (
        <Banner tone="info" title={waiting.length === 1 ? 'A refund request is waiting for review' : `${waiting.length} refund requests are waiting for review`}>
          <ul className="mt-1 space-y-0.5">
            {waiting.map(r => (
              <li key={r.id}>
                {money(r.amount)} tip from {when(r.tipAt)}
              </li>
            ))}
          </ul>
          <span className="mt-1 block">We will let you know as soon as it is decided.</span>
        </Banner>
      )}
      {declined.map(r => (
        <Banner
          key={r.id}
          tone="warning"
          title={`Your refund request for the ${money(r.amount)} tip was not approved`}
          action={
            <Button size="sm" variant="secondary" onClick={() => dismiss([r.id])}>
              Got it
            </Button>
          }
        >
          {r.declineReason ? r.declineReason : 'The tip stays as it is. If you would like to talk it through, just reply to our email.'}
        </Banner>
      ))}
    </div>
  )
}
