import { useCallback, useEffect, useState } from 'react'
import { Banner, Button, Card, EmptyState, StatusChip } from '../ui'
import { Modal } from '../ui/Modal'
import { useFeedback } from '../ui/Feedback'
import { refundRequestApi, DEFAULT_REFUND_REASONS, type AdminRefundRequest } from '../../services/refundRequestApi'
import {
  currentSubscription,
  disablePushAlerts,
  enablePushAlerts,
  getEnableFailure,
  getPushSupport,
  loadPushConfig,
  notificationPermission
} from '../../utils/pushAlerts'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const reasonLabel = (key: string) => DEFAULT_REFUND_REASONS.find(r => r.key === key)?.label ?? 'Something else'

type PushState = 'loading' | 'unavailable' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on'

/** Lets the admin turn on phone alerts for new refund requests on this device. */
function PhoneAlerts() {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const support = getPushSupport()
    if (support !== 'ready') {
      setState(support)
      return
    }
    const config = await loadPushConfig().catch(() => ({ enabled: false }))
    if (!config.enabled) return setState('unavailable')
    if (notificationPermission() === 'denied') return setState('blocked')
    setState((await currentSubscription()) && notificationPermission() === 'granted' ? 'on' : 'off')
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggle = async (turnOn: boolean) => {
    setBusy(true)
    setMessage(null)
    if (turnOn) {
      const result = await enablePushAlerts()
      if (result === 'denied') setMessage('Notifications were not allowed. You can allow them in this device’s settings.')
      else if (result === 'unavailable') setMessage('Phone alerts are not available yet.')
      else if (result === 'failed') setMessage(`Could not turn on alerts. ${getEnableFailure()}`.trim())
    } else {
      await disablePushAlerts().catch(() => undefined)
    }
    setBusy(false)
    await refresh()
  }

  return (
    <Card title="Phone alerts" subtitle="Get a banner on this phone or tablet when a performer asks for a refund.">
      {state === 'loading' && <p className="text-sm text-ink-500">Checking this device…</p>}
      {state === 'needs-install' && (
        <Banner tone="info" title="Add Tipwave to your Home Screen first">
          Apple only allows alerts for apps on the Home Screen. In Safari, tap Share, choose “Add to Home Screen”, then open Tipwave from the icon and come back here.
        </Banner>
      )}
      {state === 'unsupported' && <Banner tone="warning" title="This browser can’t show alerts">On Android use Chrome. On iPhone or iPad, add Tipwave to the Home Screen.</Banner>}
      {state === 'unavailable' && <p className="text-sm text-ink-500">Phone alerts are not available yet.</p>}
      {state === 'blocked' && <Banner tone="warning" title="Notifications are blocked">Allow notifications for Tipwave in this device’s settings, then come back.</Banner>}
      {state === 'off' && (
        <Button loading={busy} onClick={() => toggle(true)}>
          Turn on alerts on this device
        </Button>
      )}
      {state === 'on' && (
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip kind="active" label="Alerts are on for this device" />
          <Button variant="secondary" loading={busy} onClick={() => toggle(false)}>
            Turn off
          </Button>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-red-700" role="alert">{message}</p>}
    </Card>
  )
}

/**
 * Refund requests from performers. Nothing is refunded until the admin approves it here; approving runs the refund, tells the
 * performer (email and dashboard) and leaves the tipper's one-time message for their next visit.
 */
export function AdminRefunds({ onChanged }: { onChanged?: () => void }) {
  const { toast, confirm } = useFeedback()
  const [requests, setRequests] = useState<AdminRefundRequest[]>([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [declining, setDeclining] = useState<AdminRefundRequest | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  const load = useCallback(async () => {
    const res = await refundRequestApi.adminList(false)
    if (res.error || !Array.isArray(res.data?.requests)) setFailed(true)
    else {
      setFailed(false)
      setRequests(res.data.requests)
    }
    setLoaded(true)
    onChanged?.()
  }, [onChanged])

  useEffect(() => {
    void load()
    const timer = setInterval(() => document.visibilityState === 'visible' && void load(), 60000)
    return () => clearInterval(timer)
  }, [load])

  const approve = async (r: AdminRefundRequest) => {
    const ok = await confirm({
      title: `Refund ${money(r.amount)}?`,
      body: `${r.performerName}’s tip from ${when(r.tipAt)} is returned to the tipper. ${r.performerName} and the tipper are told. Stripe keeps its processing fee, so Tipwave absorbs it.`,
      confirmLabel: 'Approve and refund'
    })
    if (!ok) return
    setBusy(r.id)
    const res = await refundRequestApi.approve(r.id)
    setBusy(null)
    if (res.error) toast(res.error, 'error')
    else toast('Refund processed. The performer and the tipper have been told.', 'success')
    await load()
  }

  const decline = async () => {
    if (!declining) return
    setBusy(declining.id)
    const res = await refundRequestApi.decline(declining.id, declineReason.trim() || undefined)
    setBusy(null)
    if (res.error) {
      toast(res.error, 'error')
      return
    }
    toast('Declined. The performer has been told.', 'success')
    setDeclining(null)
    setDeclineReason('')
    await load()
  }

  const waiting = requests.filter(r => r.status === 'pending')
  const decided = requests.filter(r => r.status !== 'pending')

  return (
    <div className="space-y-5">
      <PhoneAlerts />

      {failed && (
        <Banner tone="error" title="Could not load refund requests">
          Try again in a moment.
        </Banner>
      )}

      <Card title="Waiting for you" subtitle="Oldest first" flush>
        {!loaded ? (
          <div className="h-24 animate-pulse" aria-busy="true" />
        ) : waiting.length === 0 ? (
          <EmptyState icon="coin" title="Nothing is waiting">
            Refund requests from performers appear here, and you get an email and a phone alert.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100 px-5 pb-2">
            {waiting.map(r => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-bold text-ink-900">{r.performerName}</div>
                    <div className="text-sm text-ink-500">
                      Tip from {when(r.tipAt)} · asked {when(r.requestedAt)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-700">
                      <StatusChip kind="info" label={reasonLabel(r.reason)} />
                      <span>{r.hasSongRequest ? 'Song request' : 'Tip only'}</span>
                      {r.tipStatus !== 'processed' && <StatusChip kind="failed" label={`Tip is ${r.tipStatus}`} />}
                    </div>
                    {r.note && <p className="mt-2 text-sm text-ink-900">“{r.note}”</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-ink-900">{money(r.amount)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button loading={busy === r.id} disabled={r.tipStatus !== 'processed'} onClick={() => approve(r)}>
                    Approve and refund
                  </Button>
                  <Button variant="secondary" disabled={busy === r.id} onClick={() => setDeclining(r)}>
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {decided.length > 0 && (
        <Card title="Recently decided" flush>
          <ul className="divide-y divide-slate-100 px-5 pb-2">
            {decided.map(r => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                <span className="font-semibold text-ink-900">{r.performerName}</span>
                <span className="text-ink-700">{money(r.amount)}</span>
                <StatusChip kind={r.status === 'approved' ? 'paid' : 'offline'} label={r.status === 'approved' ? 'Refunded' : 'Declined'} />
                <span className="ml-auto text-ink-500">{r.decidedAt ? when(r.decidedAt) : ''}</span>
                {r.status === 'declined' && r.declineReason && <span className="basis-full text-ink-500">{r.declineReason}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={!!declining}
        title="Decline this request?"
        onClose={() => setDeclining(null)}
        footer={
          <>
            <Button size="lg" block loading={busy === declining?.id} onClick={decline}>
              Decline
            </Button>
            <Button size="lg" block variant="ghost" onClick={() => setDeclining(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          {declining?.performerName} will get a kind email, and the tip stays as it is. You can add a reason they will see (optional).
        </p>
        <label className="sr-only" htmlFor="decline-reason">
          Reason
        </label>
        <textarea
          id="decline-reason"
          value={declineReason}
          maxLength={300}
          rows={3}
          onChange={e => setDeclineReason(e.target.value)}
          placeholder="For example: the tipper confirmed they meant to tip"
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-ink-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </Modal>
    </div>
  )
}
