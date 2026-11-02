import { useCallback, useEffect, useState } from 'react'
import { apiService } from '../../services/api'
import { Banner, Button, Card } from '../ui'
import {
  currentSubscription,
  disablePushAlerts,
  enablePushAlerts,
  getEnableFailure,
  getPushSupport,
  loadPushConfig,
  notificationPermission,
  sendTestAlert,
  type PushSupport
} from '../../utils/pushAlerts'

interface AlertsCardProps {
  /** The tip amounts this performer offers, to choose from */
  tipAmounts: number[]
}

type PushState = 'loading' | 'unavailable' | PushSupport | 'blocked' | 'off' | 'on'

const MAX_ALERT_AMOUNTS = 6

export default function AlertsCard({ tipAmounts }: AlertsCardProps) {
  const [alertAmounts, setAlertAmounts] = useState<number[]>([])
  const [amountsLoaded, setAmountsLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [amountError, setAmountError] = useState('')

  const [pushState, setPushState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    apiService.get('/api/profiles/me/alert-amounts').then(r => {
      if (cancelled) return
      if (Array.isArray(r.data?.amounts)) setAlertAmounts(r.data.amounts)
      setAmountsLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshPushState = useCallback(async () => {
    const support = getPushSupport()
    if (support !== 'ready') {
      setPushState(support)
      return
    }
    const config = await loadPushConfig().catch(() => ({ enabled: false }))
    if (!config.enabled) {
      setPushState('unavailable')
      return
    }
    if (notificationPermission() === 'denied') {
      setPushState('blocked')
      return
    }
    setPushState((await currentSubscription()) && notificationPermission() === 'granted' ? 'on' : 'off')
  }, [])

  useEffect(() => {
    void refreshPushState()
  }, [refreshPushState])

  const toggleAmount = async (amount: number) => {
    const next = alertAmounts.includes(amount) ? alertAmounts.filter(a => a !== amount) : [...alertAmounts, amount].sort((a, b) => a - b)
    if (next.length > MAX_ALERT_AMOUNTS) return
    const previous = alertAmounts
    setAlertAmounts(next)
    setAmountError('')
    setSaving(true)
    const response = await apiService.put('/api/profiles/me/alert-amounts', { amounts: next })
    setSaving(false)
    if (Array.isArray(response.data?.amounts)) {
      setAlertAmounts(response.data.amounts)
    } else {
      setAlertAmounts(previous)
      setAmountError('Could not save. Please try again.')
    }
  }

  const turnOn = async () => {
    setBusy(true)
    setMessage(null)
    const result = await enablePushAlerts()
    setBusy(false)
    if (result === 'on') setMessage({ tone: 'success', text: 'Tip alerts are on for this device.' })
    else if (result === 'denied') setMessage({ tone: 'error', text: 'Notifications were not allowed. You can allow them in this device’s settings.' })
    else if (result === 'unavailable') setMessage({ tone: 'info', text: 'Tip alerts are not available yet.' })
    else setMessage({ tone: 'error', text: `Could not turn on alerts. ${getEnableFailure()}`.trim() })
    await refreshPushState()
  }

  const turnOff = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await disablePushAlerts()
    } finally {
      setBusy(false)
    }
    await refreshPushState()
  }

  const sendTest = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const delivered = await sendTestAlert()
      setMessage(
        delivered > 0
          ? { tone: 'success', text: 'Sent. A banner should appear in a few seconds.' }
          : { tone: 'error', text: 'Nothing was delivered. Turn alerts off and on again on this device.' }
      )
    } catch {
      setMessage({ tone: 'error', text: 'Could not send the test. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Tip alerts"
      subtitle="Get a banner on your phone or tablet when a tip arrives, even while another app is open."
    >
      <div className="space-y-6">
        <section aria-labelledby="alert-amounts-title">
          <h3 id="alert-amounts-title" className="text-sm font-bold text-ink-900">
            Tips with no song
          </h3>
          <p className="mt-1 text-sm text-ink-500">
            Tips that come with a song request always show on your Live screen and alert you. Also show and alert for these amounts, even when no song is chosen:
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tip amounts to show without a song">
            {tipAmounts.map(amount => {
              const selected = alertAmounts.includes(amount)
              return (
                <button
                  key={amount}
                  type="button"
                  aria-pressed={selected}
                  disabled={!amountsLoaded || saving}
                  onClick={() => void toggleAmount(amount)}
                  className={`h-11 min-w-[4.5rem] rounded-xl border px-4 text-sm font-bold transition-colors disabled:opacity-60 ${
                    selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-ink-700 hover:bg-slate-50'
                  }`}
                >
                  ${amount}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-ink-500">
            {alertAmounts.length === 0 ? 'None chosen: only tips with a song are shown.' : `Showing tips of ${alertAmounts.map(a => `$${a}`).join(', ')} with no song.`}
          </p>
          {amountError && (
            <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
              {amountError}
            </p>
          )}
        </section>

        <section aria-labelledby="phone-alerts-title" className="border-t border-slate-100 pt-5">
          <h3 id="phone-alerts-title" className="text-sm font-bold text-ink-900">
            Alerts on this device
          </h3>

          {pushState === 'loading' && <p className="mt-2 text-sm text-ink-500">Checking this device…</p>}

          {pushState === 'needs-install' && (
            <Banner tone="info" title="Add Tipwave to your Home Screen first" className="mt-3">
              Apple only allows alerts for apps on the Home Screen. In Safari, tap the Share button, choose “Add to Home Screen”, then open Tipwave from your Home Screen and come back to this page. Needs iOS or iPadOS 16.4 or newer.
            </Banner>
          )}

          {pushState === 'unsupported' && (
            <Banner tone="warning" title="This browser can’t show tip alerts" className="mt-3">
              On Android, use Chrome. On iPad, add Tipwave to the Home Screen (iPadOS 16.4 or newer).
            </Banner>
          )}

          {pushState === 'unavailable' && (
            <Banner tone="info" title="Tip alerts are not switched on yet" className="mt-3">
              Check back soon.
            </Banner>
          )}

          {pushState === 'blocked' && (
            <Banner tone="warning" title="Notifications are blocked for Tipwave" className="mt-3">
              Open this device’s Settings, find Tipwave (or your browser) under Notifications, and allow them. Then come back here.
            </Banner>
          )}

          {pushState === 'off' && (
            <div className="mt-3">
              <Button icon="volume" loading={busy} onClick={() => void turnOn()}>
                Turn on tip alerts
              </Button>
              <p className="mt-2 text-xs text-ink-500">Your device will ask permission. The banner uses its normal notification sound.</p>
            </div>
          )}

          {pushState === 'on' && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                On for this device
              </span>
              <Button variant="secondary" size="sm" loading={busy} onClick={() => void sendTest()}>
                Send me a test
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void turnOff()}>
                Turn off
              </Button>
            </div>
          )}

          {message && (
            <p
              role={message.tone === 'error' ? 'alert' : 'status'}
              className={`mt-3 text-sm font-semibold ${message.tone === 'error' ? 'text-red-700' : message.tone === 'success' ? 'text-emerald-700' : 'text-ink-700'}`}
            >
              {message.text}
            </p>
          )}

          <p className="mt-3 text-xs text-ink-500">
            Alerts show the amount and song only, never who tipped. Do Not Disturb and Focus modes silence them, as for any app.
          </p>
        </section>
      </div>
    </Card>
  )
}
