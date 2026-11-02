import { useCallback, useEffect, useState } from 'react'
import { BrandIcon } from '../icons/BrandIcons'
import { Button, Modal, Switch } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { photoSrc } from '../../utils/photoUrl'
import { venueApi, type PerformerDevice, type PerformerVenue } from '../../services/venueApi'
import { localInputToIso, timeOnly, toLocalInput, untilLabel } from '../../utils/venueTime'
import { downloadPerformerVenueCard } from '../../utils/venueCard'

const AVAILABILITY: Record<PerformerDevice['availability'], { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'bg-emerald-50 text-emerald-700' },
  in_use: { label: 'In use', cls: 'bg-slate-100 text-ink-700' },
  in_use_by_you: { label: 'You are on', cls: 'bg-brand-50 text-brand-800' },
  requested_by_you: { label: 'Waiting for approval', cls: 'bg-amber-50 text-amber-800' },
  booked_by_you: { label: 'Booked for you', cls: 'bg-brand-50 text-brand-800' }
}

const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500'

const getPosition = (): Promise<GeolocationPosition | null> =>
  new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(p => resolve(p), () => resolve(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
  })

/**
 * "At venues" on the performer's Devices page. These cards look different from the performer's own devices (a venue
 * badge, an accent edge) so it is always clear whose device it is.
 */
export function VenueSection({ onChanged, performerId, stageName }: { onChanged?: () => void; performerId?: string; stageName?: string }) {
  const { toast, confirm } = useFeedback()
  const [venues, setVenues] = useState<PerformerVenue[]>([])
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [target, setTarget] = useState<{ venue: PerformerVenue; device: PerformerDevice } | null>(null)
  const [scheduled, setScheduled] = useState(false)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [songs, setSongs] = useState(true)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    const res = await venueApi.myVenues()
    setVenues(Array.isArray(res.data) ? res.data : [])
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
    const poll = setInterval(() => document.visibilityState === 'visible' && void load(), 30000)
    const tick = setInterval(() => setNow(Date.now()), 30000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [load])

  if (!loaded || venues.length === 0) return null

  const openActivate = (venue: PerformerVenue, device: PerformerDevice) => {
    setTarget({ venue, device })
    setScheduled(false)
    setSongs(true)
    setStartAt(toLocalInput(new Date(Date.now() + 3600000)))
    setEndAt(toLocalInput(new Date(Date.now() + 5 * 3600000)))
  }

  const activate = async () => {
    if (!target) return
    setWorking(true)
    let coords: { latitude?: number; longitude?: number; accuracyMeters?: number } = {}
    if (!scheduled && target.venue.trustLevel === 'self') {
      const pos = await getPosition()
      if (pos) coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracyMeters: pos.coords.accuracy }
    }
    const res = await venueApi.startMine({
      deviceId: target.device.deviceId,
      startsAt: scheduled ? localInputToIso(startAt) : undefined,
      endsAt: scheduled ? localInputToIso(endAt) : undefined,
      allowSongRequests: songs,
      ...coords
    })
    setWorking(false)
    if (res.error) {
      toast(res.error, 'error')
      void load()
      return
    }
    toast(res.data?.needsApproval ? res.data.notice || `Request sent to ${target.venue.venue.name}` : `You are on at ${target.venue.venue.name}`, 'success')
    setTarget(null)
    void load()
    onChanged?.()
  }

  const endMine = async (d: PerformerDevice, verb: string) => {
    if (!d.mine) return
    const ok = await confirm({ title: `${verb}?`, body: d.availability === 'in_use_by_you' ? 'The device stops paying you right away. Tips already sent stay yours.' : undefined, confirmLabel: verb, tone: 'danger' })
    if (!ok) return
    const res = await venueApi.endMine(d.mine.id)
    if (res.error) toast(res.error, 'error')
    void load()
    onChanged?.()
  }

  const downloadCard = async (d: PerformerDevice) => {
    if (!performerId) return
    try {
      await downloadPerformerVenueCard(d.deviceId, d.name, performerId, stageName || 'Performer')
      toast('Card downloaded. It only takes tips while you are on this device.', 'success')
    } catch {
      toast('Could not make the card. Please try again.', 'error')
    }
  }

  const leave = async (v: PerformerVenue) => {
    const ok = await confirm({ title: `Leave ${v.venue.name}?`, body: 'You will not be able to use their devices unless they invite you again.', confirmLabel: 'Leave venue', tone: 'danger' })
    if (!ok) return
    const res = await venueApi.leave(v.linkId)
    if (res.error) toast(res.error, 'error')
    void load()
  }

  return (
    <section aria-label="Devices at venues" className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink-900">At venues</h2>
        <p className="text-sm text-ink-500">Devices owned by venues you can perform at. Tips go to you while you are on one.</p>
      </div>

      {venues.map(v => (
        <div key={v.linkId} className="overflow-hidden rounded-2xl border border-slate-100 border-l-4 border-l-accent-500 bg-white shadow-card">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-surface px-5 py-3">
            {v.venue.logoUrl ? (
              <img src={photoSrc(v.venue.logoUrl)} alt="" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                <BrandIcon name="home" size={22} tone="current" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-ink-900">{v.venue.name}</div>
              <div className="truncate text-xs text-ink-500">{[v.venue.city, v.venue.state].filter(Boolean).join(', ') || 'Venue'}</div>
            </div>
            <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-bold text-accent-700">Venue device</span>
          </div>
          {v.devices.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-500">This venue has not added a device yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {v.devices.map(d => {
                const a = AVAILABILITY[d.availability]
                return (
                  <li key={d.deviceId} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink-900">{d.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-1 font-bold ${a.cls}`}>{a.label}</span>
                        {d.availability === 'in_use' && d.busyUntil && <span className="text-ink-500">free around {timeOnly(d.busyUntil, v.venue.timeZoneId)} ({untilLabel(d.busyUntil, now)})</span>}
                        {d.availability === 'in_use_by_you' && d.mine && <span className="text-ink-500">until {timeOnly(d.mine.endsAt, v.venue.timeZoneId)}</span>}
                        {d.availability === 'booked_by_you' && d.mine && <span className="text-ink-500">starts {timeOnly(d.mine.startsAt, v.venue.timeZoneId)}</span>}
                      </div>
                    </div>
                    {performerId && (
                      <Button size="sm" variant="ghost" onClick={() => downloadCard(d)} title="A printable card with your name. Its QR code only takes tips while you are on this device.">
                        My QR card
                      </Button>
                    )}
                    {d.availability === 'available' && <Button size="sm" onClick={() => openActivate(v, d)}>Use this device</Button>}
                    {d.availability === 'in_use_by_you' && <Button size="sm" variant="danger" onClick={() => endMine(d, 'End session')}>End session</Button>}
                    {(d.availability === 'requested_by_you' || d.availability === 'booked_by_you') && <Button size="sm" variant="secondary" onClick={() => endMine(d, 'Cancel')}>Cancel</Button>}
                    {d.availability === 'in_use' && <Button size="sm" variant="secondary" disabled>In use</Button>}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="border-t border-slate-100 px-5 py-2 text-right">
            <button type="button" onClick={() => leave(v)} className="text-xs font-semibold text-ink-500 hover:text-red-700">
              Leave this venue
            </button>
          </div>
        </div>
      ))}

      <Modal
        open={!!target}
        title={target ? `Use ${target.device.name}` : ''}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button loading={working} onClick={activate}>
              {scheduled ? 'Request this time' : target?.venue.trustLevel === 'self' ? 'Start now' : 'Ask to start now'}
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-4">
            <p className="text-ink-700">
              Tips from fans who scan {target.venue.venue.name}'s QR code go to <strong>you</strong> while you are on this device.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-ink-900">Choose a different time</div>
                <div className="text-xs text-ink-500">{scheduled ? 'The venue approves booked times.' : 'Starts now for 4 hours, then 1 hour of grace before the device disconnects.'}</div>
              </div>
              <Switch checked={scheduled} onChange={() => setScheduled(s => !s)} label="Choose a different time" />
            </div>
            {scheduled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="s-start" className="mb-1.5 block text-sm font-semibold text-ink-700">Starts</label>
                  <input id="s-start" type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="s-end" className="mb-1.5 block text-sm font-semibold text-ink-700">Ends</label>
                  <input id="s-end" type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-ink-900">Let fans request songs</div>
                <div className="text-xs text-ink-500">From your own song catalog.</div>
              </div>
              <Switch checked={songs} onChange={() => setSongs(s => !s)} label="Let fans request songs" />
            </div>
            <p className="text-xs text-ink-500">
              {!scheduled && target.venue.trustLevel === 'self'
                ? 'We will ask for your location to confirm you are at the venue. If we cannot confirm it, the venue is asked to approve instead.'
                : `${target.venue.venue.name} approves this before it starts.`}
            </p>
          </div>
        )}
      </Modal>
    </section>
  )
}
