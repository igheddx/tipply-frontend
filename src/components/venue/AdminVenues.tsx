import { useCallback, useEffect, useState } from 'react'
import { Banner, Button, Card, EmptyState, Modal, Switch, Tabs } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { venueApi, type AdminVenue } from '../../services/venueApi'

type Status = AdminVenue['status']
const TABS: { id: Status; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'rejected', label: 'Rejected' }
]

const mapLink = (v: AdminVenue) =>
  v.latitude != null && v.longitude != null
    ? `https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=18/${v.latitude}/${v.longitude}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(v.address)}`

/** Tipwave's review of venues: approve or reject new ones, suspend or reinstate, and the switch for the whole feature. */
export function AdminVenues() {
  const { toast, confirm } = useFeedback()
  const [venues, setVenues] = useState<AdminVenue[]>([])
  const [tab, setTab] = useState<Status>('pending')
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [reasonFor, setReasonFor] = useState<{ venue: AdminVenue; action: 'reject' | 'suspend' } | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    const [list, features] = await Promise.all([venueApi.adminVenues(), venueApi.adminFeatures()])
    if (Array.isArray(list.data)) setVenues(list.data)
    if (features.data) setEnabled(!!features.data.venues)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleFeature = async () => {
    const next = !enabled
    const ok = await confirm({
      title: next ? 'Turn on venue accounts?' : 'Turn off venue accounts?',
      body: next
        ? 'People can sign up as a venue on this site, and performers see venue features.'
        : 'New venue sign-ups stop and venue pages go dark. Existing venues, sessions and tips are kept.',
      confirmLabel: next ? 'Turn on' : 'Turn off'
    })
    if (!ok) return
    const res = await venueApi.adminSetVenues(next)
    if (res.error) toast(res.error, 'error')
    else setEnabled(next)
  }

  const decide = async (v: AdminVenue, action: 'approve' | 'reject' | 'suspend' | 'reinstate', why?: string) => {
    setBusy(v.id)
    const res = await venueApi.adminDecide(v.id, action, why)
    setBusy(null)
    if (res.error) toast(res.error, 'error')
    else toast(`${v.businessName}: ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'suspend' ? 'suspended' : 'reinstated'}`, 'success')
    setReasonFor(null)
    setReason('')
    await load()
  }

  const shown = venues.filter(v => v.status === tab)
  const count = (s: Status) => venues.filter(v => v.status === s).length

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-ink-900">Venue accounts</div>
            <div className="text-sm text-ink-500">
              {enabled === null ? 'Checking…' : enabled ? 'On for this site: venues can sign up and use the venue features.' : 'Off for this site: nobody can sign up as a venue yet.'}
            </div>
          </div>
          <Switch checked={!!enabled} disabled={enabled === null} onChange={toggleFeature} label="Venue accounts" />
        </div>
      </Card>

      <Tabs active={tab} onChange={id => setTab(id as Status)} items={TABS.map(t => ({ id: t.id, label: t.label, count: count(t.id) }))} />

      {loading ? null : shown.length === 0 ? (
        <Card>
          <EmptyState icon="home" title={tab === 'pending' ? 'No venues are waiting' : `No ${tab} venues`}>
            {tab === 'pending' ? 'New venues appear here as soon as they sign up, and you get an email.' : undefined}
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-4">
          {shown.map(v => (
            <li key={v.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-ink-900">{v.businessName}</h3>
                    <p className="text-sm text-ink-500">
                      {v.venueType ? `${v.venueType} · ` : ''}signed up {new Date(v.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {v.status === 'pending' && (
                      <>
                        <Button variant="secondary" disabled={busy === v.id} onClick={() => setReasonFor({ venue: v, action: 'reject' })}>
                          Reject
                        </Button>
                        <Button loading={busy === v.id} onClick={() => decide(v, 'approve')}>
                          Approve
                        </Button>
                      </>
                    )}
                    {v.status === 'approved' && (
                      <Button variant="danger" disabled={busy === v.id} onClick={() => setReasonFor({ venue: v, action: 'suspend' })}>
                        Suspend
                      </Button>
                    )}
                    {v.status === 'suspended' && (
                      <Button loading={busy === v.id} onClick={() => decide(v, 'reinstate')}>
                        Reinstate
                      </Button>
                    )}
                    {v.status === 'rejected' && (
                      <Button variant="secondary" loading={busy === v.id} onClick={() => decide(v, 'approve')}>
                        Approve after all
                      </Button>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Item label="Contact">{v.contactName}</Item>
                  <Item label="Email">
                    <a className="text-brand-700 hover:underline" href={`mailto:${v.email}`}>{v.email}</a>
                  </Item>
                  <Item label="Phone">{v.phone ? <a className="text-brand-700 hover:underline" href={`tel:${v.phone}`}>{v.phone}</a> : '—'}</Item>
                  <Item label="Time zone">{v.timeZoneId ?? '—'}</Item>
                  <div className="sm:col-span-2">
                    <Item label="Address">
                      {v.address || '—'}{' '}
                      <a className="ml-1 font-semibold text-brand-700 hover:underline" href={mapLink(v)} target="_blank" rel="noopener noreferrer">
                        See on a map
                      </a>
                    </Item>
                  </div>
                  <Item label="Activity">
                    {v.deviceCount} {v.deviceCount === 1 ? 'device' : 'devices'} · {v.linkedPerformers} linked {v.linkedPerformers === 1 ? 'performer' : 'performers'} · {v.sessionCount} {v.sessionCount === 1 ? 'session' : 'sessions'}
                  </Item>
                </dl>

                {v.statusReason && (
                  <Banner tone={v.status === 'approved' ? 'info' : 'warning'} title="Reason on record" className="mt-4">
                    {v.statusReason}
                  </Banner>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!reasonFor}
        title={reasonFor?.action === 'reject' ? `Reject ${reasonFor.venue.businessName}?` : `Suspend ${reasonFor?.venue.businessName ?? ''}?`}
        onClose={() => setReasonFor(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReasonFor(null)}>Cancel</Button>
            <Button
              variant="dangerSolid"
              disabled={!reason.trim()}
              loading={!!reasonFor && busy === reasonFor.venue.id}
              onClick={() => reasonFor && decide(reasonFor.venue, reasonFor.action, reason.trim())}
            >
              {reasonFor?.action === 'reject' ? 'Reject venue' : 'Suspend venue'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-700">
          {reasonFor?.action === 'reject'
            ? 'The venue is emailed this reason.'
            : 'Every session on its devices ends now and nobody can start a new one. The reason is kept on record.'}
        </p>
        <label htmlFor="venue-reason" className="mb-1.5 block text-sm font-semibold text-ink-700">Reason</label>
        <textarea id="venue-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </Modal>
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-900">{children}</dd>
    </div>
  )
}
