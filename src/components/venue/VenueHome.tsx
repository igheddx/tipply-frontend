import { useEffect, useState } from 'react'
import { Banner, Button, Card, EmptyState, StatusChip } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { venueApi, type VenueDevice, type VenueProfile, type VenueSession } from '../../services/venueApi'
import { PerformerChip } from './PerformerChip'
import { LocationNote } from './LocationNote'
import { timeOnly, untilLabel, windowLabel } from '../../utils/venueTime'

interface VenueHomeProps {
  venue: VenueProfile
  devices: VenueDevice[]
  requests: VenueSession[]
  linkedCount: number
  onChanged: () => void
  onGo: (tab: string) => void
}

/** What a venue most needs at a glance: who is performing now, requests waiting for an answer, and what to do next. */
export function VenueHome({ venue, devices, requests, linkedCount, onChanged, onGo }: VenueHomeProps) {
  const { toast, confirm } = useFeedback()
  const [busy, setBusy] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const decide = async (r: VenueSession, approve: boolean) => {
    setBusy(r.id)
    const res = approve ? await venueApi.approve(r.id) : await venueApi.deny(r.id)
    setBusy(null)
    if (res.error) toast(res.error, 'error')
    else toast(approve ? `${r.performer.displayName} is on` : 'Request declined', 'success')
    onChanged()
  }

  const endSession = async (s: VenueSession) => {
    const ok = await confirm({
      title: `End ${s.performer.displayName}'s session?`,
      body: 'The device stops paying them right away. Tips already sent stay theirs.',
      confirmLabel: 'End session',
      tone: 'danger'
    })
    if (!ok) return
    const res = await venueApi.end(s.id)
    if (res.error) toast(res.error, 'error')
    onChanged()
  }

  const approved = venue.status === 'approved'

  return (
    <div className="space-y-5">
      {venue.status === 'pending' && (
        <Banner tone="info" title="Waiting for Tipwave approval">
          We review every new venue. You can add your devices now; you will be able to invite performers as soon as you are approved, and we will email you.
        </Banner>
      )}
      {venue.status === 'rejected' && (
        <Banner tone="error" title="We could not approve your venue">
          {venue.statusReason || 'Contact Tipwave for details.'}
        </Banner>
      )}
      {venue.status === 'suspended' && (
        <Banner tone="warning" title="Your venue is paused">
          {venue.statusReason || 'Contact Tipwave for details.'} No performer can use your devices until this is lifted.
        </Banner>
      )}

      {approved && !venue.hasLocation && (
        <Banner
          tone="warning"
          title="Add your venue's location"
          action={<Button size="sm" variant="secondary" onClick={() => onGo('profile')}>Set location</Button>}
        >
          Performers you trust can only start a session by themselves when their phone shows they are at your venue. Open your profile on a device at the venue and tap “Use my current location”.
        </Banner>
      )}

      {requests.length > 0 && (
        <Card title={`${requests.length} ${requests.length === 1 ? 'request' : 'requests'} waiting`} subtitle="Performers asking to use a device.">
          <ul className="divide-y divide-slate-100">
            {requests.map(r => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <PerformerChip performer={r.performer} sub={`${r.deviceName} · ${windowLabel(r.startsAt, r.endsAt, venue.timeZoneId)}`} />
                  <div className="mt-1 pl-12">
                    <LocationNote session={r} />
                  </div>
                </div>
                <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => decide(r, false)}>
                  Decline
                </Button>
                <Button size="sm" loading={busy === r.id} onClick={() => decide(r, true)}>
                  Approve
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Your devices" subtitle="Who is performing right now.">
        {devices.length === 0 ? (
          <EmptyState icon="device" title="No devices yet" action={<Button onClick={() => onGo('devices')}>Add a device</Button>}>
            Add the serial number printed on your Tipwave device.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {devices.map(d => (
              <li key={d.deviceId} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-900">{d.name}</div>
                    {d.current ? (
                      <div className="mt-2">
                        <PerformerChip performer={d.current.performer} sub={`${d.current.state === 'grace' ? 'Finishing up' : 'Performing'} until ${timeOnly(d.current.state === 'grace' ? d.current.graceEndsAt : d.current.endsAt, venue.timeZoneId)} (${untilLabel(d.current.state === 'grace' ? d.current.graceEndsAt : d.current.endsAt, now)} left) · ${d.current.tipCount} ${d.current.tipCount === 1 ? 'tip' : 'tips'}`} />
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-ink-500">No one is performing.{d.upcomingSessions > 0 ? ` ${d.upcomingSessions} booked.` : ''}</p>
                    )}
                  </div>
                  {d.isPaused && <StatusChip kind="paused" />}
                  {d.current ? (
                    <Button size="sm" variant="danger" onClick={() => endSession(d.current!)}>
                      End session
                    </Button>
                  ) : (
                    approved && linkedCount > 0 && (
                      <Button size="sm" variant="secondary" onClick={() => onGo('devices')}>
                        Start a session
                      </Button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {approved && linkedCount === 0 && (
        <Card>
          <EmptyState icon="users" title="Invite your first performer" action={<Button onClick={() => onGo('performers')}>Find performers</Button>}>
            Search for performers on Tipwave, or invite someone by email. Once they accept, they can use your devices.
          </EmptyState>
        </Card>
      )}
    </div>
  )
}
