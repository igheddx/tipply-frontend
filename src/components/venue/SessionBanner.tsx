import { useCallback, useEffect, useState } from 'react'
import { Banner, Button } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { venueApi, type VenueSession } from '../../services/venueApi'
import { timeOnly, untilLabel } from '../../utils/venueTime'

const POLL_MS = 60000
const HEADS_UP_MINUTES = 30

/**
 * The performer's reminder while they are on a venue's device. Calm while the session runs, a heads-up near the end of the
 * main window, and a clear warning once the grace hour has started (the device disconnects from them when it ends).
 */
export function SessionBanner({ compact = false }: { compact?: boolean }) {
  const { toast, confirm } = useFeedback()
  const [session, setSession] = useState<VenueSession | null>(null)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await venueApi.currentSession()
    setSession(res.data?.session ?? null)
  }, [])

  useEffect(() => {
    void load()
    const poll = setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS)
    const tick = setInterval(() => setNow(Date.now()), 20000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [load])

  if (!session) return null
  // The server decides whether the session is current; this keeps the message right between refreshes
  if (new Date(session.graceEndsAt).getTime() <= now) return null

  const inGrace = new Date(session.endsAt).getTime() <= now
  const minutesLeft = Math.round((new Date(session.endsAt).getTime() - now) / 60000)
  const headsUp = !inGrace && minutesLeft <= HEADS_UP_MINUTES

  const extend = async () => {
    setBusy(true)
    const res = await venueApi.extendMine(session.id)
    setBusy(false)
    if (res.error) toast(res.error, 'error')
    else toast('Added one more hour', 'success')
    void load()
  }

  const end = async () => {
    const ok = await confirm({
      title: 'End your session?',
      body: `${session.deviceName} at ${session.venueName} stops paying you right away. Tips already sent stay yours.`,
      confirmLabel: 'End session',
      tone: 'danger'
    })
    if (!ok) return
    setBusy(true)
    const res = await venueApi.endMine(session.id)
    setBusy(false)
    if (res.error) toast(res.error, 'error')
    void load()
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      {(inGrace || headsUp) && (
        <Button size="sm" loading={busy} onClick={extend}>
          Add an hour
        </Button>
      )}
      <Button size="sm" variant="secondary" disabled={busy} onClick={end}>
        End session
      </Button>
    </div>
  )

  const wrap = compact ? 'px-3 pt-2' : ''

  if (inGrace) {
    return (
      <div className={wrap}>
        <Banner tone="warning" title={`Your time on ${session.deviceName} is up. It disconnects in ${untilLabel(session.graceEndsAt, now)}.`} action={actions}>
          {session.venueName} gave you until {timeOnly(session.endsAt, undefined)} plus an hour of grace. Add an hour if you are still playing.
        </Banner>
      </div>
    )
  }

  return (
    <div className={wrap}>
      <Banner
        tone={headsUp ? 'warning' : 'info'}
        title={headsUp ? `Your session ends in ${untilLabel(session.endsAt, now)}` : `You are on ${session.deviceName} at ${session.venueName}`}
        action={actions}
      >
        {headsUp
          ? 'After that you get one more hour before the device disconnects from you.'
          : `Tips go to you until ${timeOnly(session.endsAt, undefined)}, then an hour of grace.`}
      </Banner>
    </div>
  )
}
