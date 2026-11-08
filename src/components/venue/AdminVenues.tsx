import { useCallback, useEffect, useState } from 'react'
import { Banner, Button, Card, EmptyState, Modal, Switch, Tabs } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { showApi } from '../../services/showApi'
import { venueApi, type AdminVenue, type AuditEntry } from '../../services/venueApi'

type Status = AdminVenue['status']
type TabId = Status | 'activity'
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
  const [tab, setTab] = useState<TabId>('pending')
  const [showsOn, setShowsOn] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [reasonFor, setReasonFor] = useState<{ venue: AdminVenue; action: 'reject' | 'suspend' } | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    const [list, features] = await Promise.all([venueApi.adminVenues(), venueApi.adminFeatures()])
    if (Array.isArray(list.data)) setVenues(list.data)
    if (features.data) {
      setEnabled(!!features.data.venues)
      setShowsOn(!!features.data.shows)
    }
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

  const toggleShows = async () => {
    const next = !showsOn
    const ok = await confirm({
      title: next ? 'Turn on performer shows?' : 'Turn off performer shows?',
      body: next
        ? 'Performers see a "This show" card and a Shows list that totals each stretch of playing, even past midnight.'
        : 'The "This show" card and Shows list are hidden. Tips and totals elsewhere are not affected, and shows are kept.',
      confirmLabel: next ? 'Turn on' : 'Turn off'
    })
    if (!ok) return
    const res = await showApi.adminSetShows(next)
    if (res.error) toast(res.error, 'error')
    else setShowsOn(next)
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

  const shown = tab === 'activity' ? [] : venues.filter(v => v.status === tab)
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

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-ink-900">Performer shows</div>
            <div className="text-sm text-ink-500">
              {showsOn === null ? 'Checking…' : showsOn ? 'On for this site: performers see what they made in each show.' : 'Off for this site: performers see only the usual totals.'}
            </div>
          </div>
          <Switch checked={!!showsOn} disabled={showsOn === null} onChange={toggleShows} label="Performer shows" />
        </div>
      </Card>

      <Tabs active={tab} onChange={id => setTab(id as TabId)} items={[...TABS.map(t => ({ id: t.id, label: t.label, count: count(t.id) })), { id: 'activity', label: 'Activity' }]} />

      {tab === 'activity' ? (
        <AuditLog />
      ) : loading ? null : shown.length === 0 ? (
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
                      <span className={`mt-1 block text-xs font-semibold ${v.addressMatched ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {v.addressMatched
                          ? `Address found${v.matchedAddress ? `: ${v.matchedAddress}` : ''}`
                          : 'The address lookup could not find this address. Check it on the map before approving.'}
                      </span>
                    </Item>
                  </div>
                  <div className="sm:col-span-2">
                    <Item label="Devices claimed">
                      {v.devices.length === 0 ? '—' : v.devices.map(d => `${d.serialNumber ?? 'no serial'}${d.nickname ? ` (${d.nickname})` : ''}`).join(', ')}
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

const ACTION_TEXT: Record<string, string> = {
  venue_signed_up: 'signed up',
  venue_approve: 'was approved',
  venue_reject: 'was rejected',
  venue_suspend: 'was suspended',
  venue_reinstate: 'was reinstated',
  venue_profile_updated: 'updated their profile',
  invited: 'invited a performer',
  invited_by_email: 'invited someone by email',
  invite_resent: 'sent an invitation again',
  invite_accepted: 'accepted an invitation',
  invite_declined: 'declined an invitation',
  invite_auto_accepted: 'was linked automatically',
  link_deactivate: 'turned a performer\'s access off',
  link_reactivate: 'turned a performer\'s access back on',
  link_cancel: 'cancelled an invitation',
  link_left: 'left the venue',
  trust_changed: 'changed who can start without asking',
  session_requested: 'asked to start a session',
  session_started_self: 'started a session by themselves',
  session_started_by_venue: 'started a session for a performer',
  session_approved: 'approved a session',
  session_denied: 'declined a session',
  session_ended: 'ended a session',
  session_extended: 'added an hour to a session'
}

/** Read-only record of what happened in the venue feature, newest first. */
function AuditLog() {
  const [items, setItems] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    venueApi.adminAudit(page, filter || undefined).then(res => {
      if (cancelled) return
      setLoading(false)
      setItems(res.data?.items ?? [])
      setTotal(res.data?.total ?? 0)
    })
    return () => {
      cancelled = true
    }
  }, [page, filter])

  return (
    <Card title="Activity" subtitle="Who did what, newest first." flush>
      <div className="flex flex-wrap items-center gap-3 px-5 pt-1">
        <label htmlFor="audit-filter" className="text-sm font-semibold text-ink-700">Show</label>
        <select
          id="audit-filter"
          value={filter}
          onChange={e => {
            setFilter(e.target.value)
            setPage(1)
          }}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-ink-900"
        >
          <option value="">Everything</option>
          {Object.entries(ACTION_TEXT).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>
      {!loading && items.length === 0 ? (
        <EmptyState icon="clock" title="Nothing yet">Activity appears here as venues and performers use Tipwave.</EmptyState>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 px-5 pb-2">
          {items.map(a => (
            <li key={a.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-ink-900">
                  <strong>{a.actorName || 'Someone'}</strong> {ACTION_TEXT[a.action] ?? a.action}
                  {a.subjectName && a.subjectName !== a.actorName ? <> ({a.subjectName})</> : null}
                  {a.deviceName ? <> on {a.deviceName}</> : null}
                </span>
                <span className="text-xs text-ink-500">{new Date(a.at).toLocaleString()}</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-500">
                {a.venueName && <>{a.venueName}</>}
                {a.detail ? <> · {a.detail}</> : null}
                {a.ipAddress ? <> · {a.ipAddress}</> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {total > 50 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <span className="text-sm text-ink-500">{(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="secondary" disabled={page * 50 >= total || loading} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
