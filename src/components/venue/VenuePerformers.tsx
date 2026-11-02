import { useEffect, useRef, useState } from 'react'
import { Banner, Button, Card, EmptyState, Switch } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { venueApi, type PerformerCard, type VenueLink, type VenueProfile } from '../../services/venueApi'
import { PerformerChip } from './PerformerChip'
import { dayAndTime } from '../../utils/venueTime'

interface Props {
  venue: VenueProfile
  links: VenueLink[]
  onChanged: () => void
}

const STATUS_TEXT: Record<string, string> = { invited: 'Invited', active: 'Linked', deactivated: 'Access off' }

export function VenuePerformers({ venue, links, onChanged }: Props) {
  const { toast, confirm } = useFeedback()
  const approved = venue.status === 'approved'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PerformerCard[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const requestId = useRef(0)

  // Search as the venue types
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    const id = ++requestId.current
    setSearching(true)
    const timer = setTimeout(async () => {
      const res = await venueApi.search(q)
      if (id !== requestId.current) return
      setSearching(false)
      setResults(Array.isArray(res.data) ? res.data : [])
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const invitePerformer = async (p: PerformerCard) => {
    setBusy(p.id)
    const res = await venueApi.invite({ performerId: p.id })
    setBusy(null)
    if (res.error) toast(res.error, 'error')
    else {
      toast(`Invitation sent to ${p.displayName}`, 'success')
      setResults(prev => (prev ? prev.filter(x => x.id !== p.id) : prev))
    }
    onChanged()
  }

  const inviteEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy('email')
    const res = await venueApi.invite({ email: email.trim() })
    setBusy(null)
    if (res.error) toast(res.error, 'error')
    else {
      toast(`Invitation sent to ${email.trim()}`, 'success')
      setEmail('')
    }
    onChanged()
  }

  const change = async (l: VenueLink, action: 'deactivate' | 'reactivate' | 'cancel') => {
    if (action === 'deactivate') {
      const ok = await confirm({
        title: `Turn off ${l.performer?.displayName ?? 'this performer'}'s access?`,
        body: 'Any session they have now ends right away and they can no longer use your devices. You can turn it back on later.',
        confirmLabel: 'Turn off access',
        tone: 'danger'
      })
      if (!ok) return
    }
    setBusy(l.id)
    const res = await venueApi.changeLink(l.id, action)
    setBusy(null)
    if (res.error) toast(res.error, 'error')
    onChanged()
  }

  const setTrust = async (l: VenueLink, self: boolean) => {
    setBusy(l.id)
    const res = await venueApi.setTrust(l.id, self ? 'self' : 'approval')
    setBusy(null)
    if (res.error) toast(res.error, 'error')
    onChanged()
  }

  const visible = links.filter(l => ['invited', 'active', 'deactivated'].includes(l.status))

  return (
    <div className="space-y-5">
      {!approved && (
        <Banner tone="info" title="Invitations open once Tipwave approves your venue">
          You will get an email as soon as it is approved.
        </Banner>
      )}

      <Card title="Find a performer" subtitle="Search performers who are set up on Tipwave.">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={!approved}
            placeholder="Search by stage name or name"
            aria-label="Search performers"
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
          />
          {searching && <span className="absolute right-4 top-3.5 h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />}
        </div>
        {results && (
          <ul className="mt-3 divide-y divide-slate-100">
            {results.length === 0 && <li className="py-4 text-sm text-ink-500">No performers found. Try another spelling, or invite them by email below.</li>}
            {results.map(p => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <PerformerChip performer={p} />
                </div>
                <Button size="sm" loading={busy === p.id} onClick={() => invitePerformer(p)}>
                  Invite
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={inviteEmail} className="mt-5 border-t border-slate-100 pt-4">
          <label htmlFor="invite-email" className="mb-1.5 block text-sm font-semibold text-ink-700">
            Not on Tipwave yet? Invite by email
          </label>
          <div className="flex gap-2">
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={!approved}
              placeholder="performer@example.com"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
            />
            <Button type="submit" variant="secondary" disabled={!approved || !email.trim()} loading={busy === 'email'}>
              Send invite
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-ink-500">They get an email to create a performer account and set up payouts. Once they finish, they are linked to your venue automatically.</p>
        </form>
      </Card>

      <Card title="Your performers" subtitle="People who can use your devices.">
        {visible.length === 0 ? (
          <EmptyState icon="users" title="No performers yet">
            Search above, or invite someone by email.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map(l => {
              const name = l.performer?.displayName ?? l.inviteEmail ?? 'Invited'
              return (
                <li key={l.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {l.performer ? (
                        <PerformerChip
                          performer={l.performer}
                          sub={
                            l.status === 'active'
                              ? `${l.sessionCount} ${l.sessionCount === 1 ? 'session' : 'sessions'}${l.lastSessionAt ? ` · last ${dayAndTime(l.lastSessionAt, venue.timeZoneId)}` : ''}`
                              : undefined
                          }
                        />
                      ) : (
                        <div className="font-semibold text-ink-900">{name}</div>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        l.status === 'active' ? 'bg-emerald-50 text-emerald-700' : l.status === 'invited' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-ink-500'
                      }`}
                    >
                      {STATUS_TEXT[l.status] ?? l.status}
                      {l.status === 'invited' && !l.performer ? ' by email' : ''}
                    </span>
                    {l.status === 'active' && (
                      <Button size="sm" variant="danger" disabled={busy === l.id} onClick={() => change(l, 'deactivate')}>
                        Turn off
                      </Button>
                    )}
                    {l.status === 'deactivated' && (
                      <Button size="sm" variant="secondary" disabled={busy === l.id} onClick={() => change(l, 'reactivate')}>
                        Turn back on
                      </Button>
                    )}
                    {l.status === 'invited' && (
                      <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => change(l, 'cancel')}>
                        Cancel invite
                      </Button>
                    )}
                  </div>
                  {l.status === 'active' && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink-900">Can start a session without asking</div>
                        <div className="text-xs text-ink-500">When on, they start by themselves while at your venue. When off, you approve each request.</div>
                      </div>
                      <Switch checked={l.trustLevel === 'self'} onChange={() => setTrust(l, l.trustLevel !== 'self')} label={`${name} can start sessions without asking`} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
