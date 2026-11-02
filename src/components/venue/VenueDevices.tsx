import { useState } from 'react'
import { Banner, Button, Card, EmptyState, Modal, StatusChip, Switch } from '../ui'
import { useFeedback } from '../ui/Feedback'
import apiService from '../../services/api'
import { venueApi, type VenueDevice, type VenueLink, type VenueProfile } from '../../services/venueApi'
import { API_BASE_URL } from '../../utils/config'
import { SOUND_OPTIONS, VOLUME_OPTIONS } from '../../utils/deviceConfig'
import { PerformerChip } from './PerformerChip'
import { localInputToIso, timeOnly, toLocalInput } from '../../utils/venueTime'

interface Props {
  venue: VenueProfile
  devices: VenueDevice[]
  links: VenueLink[]
  onChanged: () => void
}

const selectClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500'

export function VenueDevices({ venue, devices, links, onChanged }: Props) {
  const { toast, confirm } = useFeedback()
  const approved = venue.status === 'approved'
  const active = links.filter(l => l.status === 'active' && l.performer)

  const [adding, setAdding] = useState(false)
  const [serial, setSerial] = useState('')
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)

  const [starting, setStarting] = useState<VenueDevice | null>(null)
  const [performerId, setPerformerId] = useState('')
  const [scheduled, setScheduled] = useState(false)
  const [startAt, setStartAt] = useState(toLocalInput(new Date(Date.now() + 3600000)))
  const [endAt, setEndAt] = useState(toLocalInput(new Date(Date.now() + 5 * 3600000)))

  const [settings, setSettings] = useState<VenueDevice | null>(null)
  const [qr, setQr] = useState<VenueDevice | null>(null)

  const addDevice = async () => {
    if (!serial.trim()) return
    setSaving(true)
    const res = await apiService.addDevice({ serialNumber: serial.trim(), nickname: nickname.trim() || undefined, isAllowSongRequest: false })
    setSaving(false)
    if (res.error) {
      toast(res.error, 'error')
      return
    }
    toast('Device added', 'success')
    setAdding(false)
    setSerial('')
    setNickname('')
    onChanged()
  }

  const openStart = (d: VenueDevice) => {
    setStarting(d)
    setPerformerId(active[0]?.performer?.id ?? '')
    setScheduled(false)
    setStartAt(toLocalInput(new Date(Date.now() + 3600000)))
    setEndAt(toLocalInput(new Date(Date.now() + 5 * 3600000)))
  }

  const startSession = async () => {
    if (!starting || !performerId) return
    setSaving(true)
    const res = await venueApi.startForPerformer({
      deviceId: starting.deviceId,
      performerId,
      startsAt: scheduled ? localInputToIso(startAt) : undefined,
      endsAt: scheduled ? localInputToIso(endAt) : undefined
    })
    setSaving(false)
    if (res.error) {
      toast(res.error, 'error')
      return
    }
    toast(scheduled ? 'Session booked' : 'Session started', 'success')
    setStarting(null)
    onChanged()
  }

  const endSession = async (d: VenueDevice) => {
    if (!d.current) return
    const ok = await confirm({
      title: `End ${d.current.performer.displayName}'s session?`,
      body: 'The device stops paying them right away. Tips already sent stay theirs.',
      confirmLabel: 'End session',
      tone: 'danger'
    })
    if (!ok) return
    const res = await venueApi.end(d.current.id)
    if (res.error) toast(res.error, 'error')
    onChanged()
  }

  const saveSetting = async (d: VenueDevice, patch: { isSoundEnabled?: boolean; soundId?: number; soundVolume?: string; isRandomLightEffect?: boolean; paused?: boolean }) => {
    const res =
      patch.paused !== undefined
        ? await apiService.updateDevicePause(d.deviceId, patch.paused)
        : await apiService.updateDeviceConfiguration(d.deviceId, patch)
    if (res.error) toast(res.error, 'error')
    onChanged()
    setSettings(prev => (prev && prev.deviceId === d.deviceId ? { ...prev, ...(patch.paused !== undefined ? { isPaused: patch.paused } : patch) } : prev))
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button icon="plus" onClick={() => setAdding(true)}>
          Add a device
        </Button>
      </div>

      {devices.length === 0 ? (
        <Card>
          <EmptyState icon="device" title="No devices yet" action={<Button onClick={() => setAdding(true)}>Add a device</Button>}>
            Add the serial number printed on your Tipwave device.
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-4">
          {devices.map(d => (
            <li key={d.deviceId}>
              <Card>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-ink-900">{d.name}</h3>
                      {d.isPaused && <StatusChip kind="paused" />}
                    </div>
                    {d.serialNumber && <div className="text-xs text-ink-500">Serial {d.serialNumber}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setQr(d)}>
                      QR code
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setSettings(d)}>
                      Settings
                    </Button>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  {d.current ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <PerformerChip
                          performer={d.current.performer}
                          sub={`${d.current.state === 'grace' ? 'Finishing up, device disconnects ' + timeOnly(d.current.graceEndsAt, venue.timeZoneId) : 'Until ' + timeOnly(d.current.endsAt, venue.timeZoneId)} · ${d.current.tipCount} ${d.current.tipCount === 1 ? 'tip' : 'tips'}`}
                        />
                      </div>
                      <Button size="sm" variant="danger" onClick={() => endSession(d)}>
                        End session
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="min-w-0 flex-1 text-sm text-ink-500">
                        No one is performing. Tips are paused on this device.
                        {d.pendingRequests > 0 && ` ${d.pendingRequests} waiting for your approval.`}
                        {d.upcomingSessions > 0 && ` ${d.upcomingSessions} booked.`}
                      </p>
                      <Button size="sm" disabled={!approved || active.length === 0} onClick={() => openStart(d)}>
                        Start a session
                      </Button>
                    </div>
                  )}
                </div>
                {approved && active.length === 0 && !d.current && <p className="mt-2 text-xs text-ink-500">Invite a performer first; they appear here once they accept.</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Add a device */}
      <Modal
        open={adding}
        title="Add a device"
        onClose={() => setAdding(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!serial.trim()} onClick={addDevice}>
              Add device
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="v-serial" className="mb-1.5 block text-sm font-semibold text-ink-700">Serial number</label>
            <input id="v-serial" value={serial} onChange={e => setSerial(e.target.value)} autoCapitalize="characters" placeholder="TPY-5C07-K73" className={`${selectClass} uppercase placeholder:normal-case`} />
            <p className="mt-1.5 text-sm text-ink-500">Printed on the back of the device.</p>
          </div>
          <div>
            <label htmlFor="v-nick" className="mb-1.5 block text-sm font-semibold text-ink-700">Name <span className="font-normal text-ink-500">(optional)</span></label>
            <input id="v-nick" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Main stage" className={selectClass} />
            <p className="mt-1.5 text-sm text-ink-500">Performers choose a device by this name.</p>
          </div>
        </div>
      </Modal>

      {/* Start a session for a performer */}
      <Modal
        open={!!starting}
        title={`Start a session on ${starting?.name ?? ''}`}
        onClose={() => setStarting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStarting(null)}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!performerId} onClick={startSession}>
              {scheduled ? 'Book session' : 'Start now'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="v-performer" className="mb-1.5 block text-sm font-semibold text-ink-700">Performer</label>
            <select id="v-performer" value={performerId} onChange={e => setPerformerId(e.target.value)} className={selectClass}>
              {active.map(l => (
                <option key={l.id} value={l.performer!.id}>
                  {l.performer!.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-ink-900">Book for a set time</div>
              <div className="text-xs text-ink-500">{scheduled ? 'Choose when they start and finish.' : 'Starts now and runs for 4 hours, then 1 hour of grace before the device disconnects.'}</div>
            </div>
            <Switch checked={scheduled} onChange={() => setScheduled(v => !v)} label="Book for a set time" />
          </div>
          {scheduled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="v-start" className="mb-1.5 block text-sm font-semibold text-ink-700">Starts</label>
                <input id="v-start" type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={selectClass} />
              </div>
              <div>
                <label htmlFor="v-end" className="mb-1.5 block text-sm font-semibold text-ink-700">Ends</label>
                <input id="v-end" type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} className={selectClass} />
              </div>
              <p className="text-xs text-ink-500 sm:col-span-2">Times are in your local time. The device keeps paying the performer for 1 hour after the end time.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Settings */}
      <Modal open={!!settings} title={`${settings?.name ?? ''} settings`} onClose={() => setSettings(null)} footer={<Button onClick={() => setSettings(null)}>Done</Button>}>
        {settings && (
          <div className="space-y-4">
            <Banner tone="info" title="These reset for each performer">
              The performer on the device chooses their own tip amounts and song requests. Light, sound and pause go back to Tipwave's defaults when each performer finishes.
            </Banner>
            <Row title="Pause everything" text="No light or sound. Tips still go through.">
              <Switch checked={settings.isPaused} onChange={() => saveSetting(settings, { paused: !settings.isPaused })} label="Pause everything" />
            </Row>
            <Row title="Sound" text="Play a sound with each tip.">
              <Switch checked={settings.isSoundEnabled} onChange={() => saveSetting(settings, { isSoundEnabled: !settings.isSoundEnabled })} label="Sound" />
            </Row>
            {settings.isSoundEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="v-sound" className="mb-1.5 block text-sm font-semibold text-ink-700">Sound</label>
                  <select id="v-sound" className={selectClass} value={settings.soundId} onChange={e => saveSetting(settings, { soundId: Number(e.target.value) })}>
                    {SOUND_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="v-vol" className="mb-1.5 block text-sm font-semibold text-ink-700">Volume</label>
                  <select id="v-vol" className={selectClass} value={settings.soundVolume} onChange={e => saveSetting(settings, { soundVolume: e.target.value })}>
                    {VOLUME_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <Row title="Random light effect" text="A different effect for every tip.">
              <Switch checked={settings.isRandomLightEffect} onChange={() => saveSetting(settings, { isRandomLightEffect: !settings.isRandomLightEffect })} label="Random light effect" />
            </Row>
          </div>
        )}
      </Modal>

      {/* QR code */}
      <Modal open={!!qr} title={`${qr?.name ?? ''} QR code`} onClose={() => setQr(null)} footer={
        qr ? (
          <>
            <a href={`${API_BASE_URL}/api/devices/${qr.deviceId}/qr`} download={`tipwave-${qr.name}.png`} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-ink-700 hover:bg-slate-50">
              Download
            </a>
            <Button onClick={() => setQr(null)}>Done</Button>
          </>
        ) : undefined
      }>
        {qr && (
          <div className="text-center">
            <img src={`${API_BASE_URL}/api/devices/${qr.deviceId}/qr`} alt={`QR code for ${qr.name}`} className="mx-auto h-56 w-56" />
            <p className="mt-3 text-sm text-ink-500">This code always works. Fans who scan it tip whoever is performing on this device.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Row({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        <div className="text-xs text-ink-500">{text}</div>
      </div>
      {children}
    </div>
  )
}
