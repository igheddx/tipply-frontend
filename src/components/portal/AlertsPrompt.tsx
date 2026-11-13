import { useEffect, useState } from 'react'
import { Banner, Button } from '../ui'
import {
  currentSubscription,
  enablePushAlerts,
  getEnableFailure,
  getPushSupport,
  loadPushConfig,
  notificationPermission
} from '../../utils/pushAlerts'

const DISMISSED_KEY = 'tipwave_alerts_prompt_dismissed'

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

type Offer = 'none' | 'turn-on' | 'install'

/**
 * Offered once, on Home, until the performer turns tip alerts on for this phone or tablet (or says "Not now"). It asks for nothing
 * the phone has not already agreed to: a tap on "Turn on" is what makes the phone show its own permission question. An iPhone or iPad
 * only allows alerts for a site added to the Home Screen, so there the prompt says how. The full settings are on the Devices page.
 */
export default function AlertsPrompt() {
  const [offer, setOffer] = useState<Offer>('none')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const decide = async () => {
      if (wasDismissed()) return
      const support = getPushSupport()
      if (support === 'unsupported') return
      if (support === 'needs-install') {
        if (!cancelled) setOffer('install')
        return
      }
      const config = await loadPushConfig().catch(() => ({ enabled: false }))
      if (!config.enabled) return
      if (notificationPermission() !== 'default') return // already allowed, or blocked: the Devices page explains
      if (await currentSubscription()) return
      if (!cancelled) setOffer('turn-on')
    }
    void decide()
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      /* the prompt just shows again next time */
    }
    setOffer('none')
    setMessage(null)
  }

  const turnOn = async () => {
    setBusy(true)
    setMessage(null)
    const result = await enablePushAlerts()
    setBusy(false)
    if (result === 'on') {
      setMessage({ tone: 'success', text: 'Tip alerts are on for this device. You will get a banner when a tip arrives.' })
      setOffer('none')
    } else if (result === 'denied') {
      setMessage({ tone: 'error', text: 'Notifications were not allowed. You can allow them later in this device’s settings.' })
      setOffer('none')
    } else {
      setMessage({ tone: 'error', text: `Could not turn on alerts. ${getEnableFailure()}`.trim() })
    }
  }

  if (offer === 'none' && !message) return null

  if (offer === 'none' && message) {
    return (
      <Banner tone={message.tone} title={message.tone === 'success' ? 'Tip alerts are on' : 'Tip alerts'}>
        {message.text}
      </Banner>
    )
  }

  return (
    <Banner tone="info" title="Get a banner when a tip arrives">
      {offer === 'install' ? (
        <p>
          On an iPhone or iPad, add Tipwave to your Home Screen first (Share, then Add to Home Screen), then open it from there to turn on tip alerts.
        </p>
      ) : (
        <p>See every tip on your phone or tablet, even while another app is open.</p>
      )}
      {message && <p className="mt-1 font-semibold">{message.text}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {offer === 'turn-on' && (
          <Button size="sm" loading={busy} onClick={() => void turnOn()}>
            Turn on tip alerts
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </Banner>
  )
}
