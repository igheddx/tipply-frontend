import { useState } from 'react'
import { Button } from '../ui'
import { payoutApi } from '../../services/payoutApi'

const TRY_AGAIN = 'Your payouts page could not be opened just now. Please try again in a moment.'

/**
 * The door from the portal to the performer's own Stripe dashboard, where they see their balance, withdraw, and choose automatic or manual
 * payouts. Stripe pays performers out, so those controls live there. The link is made when they tap (it works once and expires in minutes).
 */
export function ManagePayouts() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const open = async () => {
    setBusy(true)
    setMessage(null)
    // Open the tab now, while the tap is fresh: phones block a tab that is opened after waiting on the network
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    try {
      const res = await payoutApi.dashboardLink()
      const url = res.data && typeof res.data.url === 'string' ? res.data.url : null
      if (url) {
        if (tab) tab.location.href = url
        else window.location.assign(url) // the browser would not open a new tab: go there in this one
      } else {
        tab?.close()
        setMessage(res.error || TRY_AGAIN)
      }
    } catch {
      tab?.close()
      setMessage(TRY_AGAIN)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 flex-1 text-sm text-ink-700">See your balance, withdraw, and choose automatic or manual payouts in your Stripe dashboard.</p>
      <Button size="sm" variant="secondary" icon="wallet" loading={busy} onClick={() => void open()}>
        Manage payouts
      </Button>
      {message && (
        <p role="alert" className="w-full text-sm font-semibold text-red-700">
          {message}
        </p>
      )}
    </div>
  )
}
