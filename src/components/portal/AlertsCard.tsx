import { useCallback, useEffect, useState } from 'react'
import { apiService } from '../../services/api'
import { Banner, Button, Card, Switch } from '../ui'
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
  /** No longer used: alerts cover every tip, so there is no amount to choose. Kept so existing callers still compile. */
  tipAmounts?: number[]
}

type PushState = 'loading' | 'unavailable' | PushSupport | 'blocked' | 'off' | 'on'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AlertsCard(_props: AlertsCardProps) {
  // Phone alerts cover every tip (the default). On: only tips that come with a song request alert.
  const [songsOnly, setSongsOnly] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [pushState, setPushState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    apiService.get('/api/profiles/me/alert-preference').then(r => {
      if (cancelled) return
      if (typeof r.data?.songsOnly === 'boolean') setSongsOnly(r.data.songsOnly)
      setLoaded(true)
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

  // The service worker tells the page when a test alert reaches this device
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'tipwave-push' && event.data.tag === 'tipwave-test') {
        setMessage({
          tone: 'success',
          text: 'The test reached this device. If no banner appeared, open this device’s Settings > Notifications, allow Tipwave (or your browser), and turn off Do Not Disturb.'
        })
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  const toggleSongsOnly = async () => {
    const next = !songsOnly
    setSongsOnly(next)
    setSaveError('')
    setSaving(true)
    const response = await apiService.put('/api/profiles/me/alert-preference', { songsOnly: next })
    setSaving(false)
    if (typeof response.data?.songsOnly === 'boolean') {
      setSongsOnly(response.data.songsOnly)
    } else {
      setSongsOnly(!next)
      setSaveError('Could not save. Please try again.')
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
        <section aria-labelledby="alert-which-title">
          <h3 id="alert-which-title" className="text-sm font-bold text-ink-900">
            Which tips alert you
          </h3>
          <p className="mt-1 text-sm text-ink-500">
            Every tip shows on your Live tab, and every tip sends an alert to your phone or tablet, with or without a song request.
          </p>
          <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-slate-100 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink-900">Only alert me for tips with a song</div>
              <p className="mt-0.5 text-xs text-ink-500">Tips with no song still show on your Live tab, but they stay quiet.</p>
            </div>
            <Switch checked={songsOnly} disabled={!loaded || saving} onChange={() => void toggleSongsOnly()} label="Only alert me for tips with a song" />
          </div>
          {saveError && (
            <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
              {saveError}
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
