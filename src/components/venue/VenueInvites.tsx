import { useEffect, useState } from 'react'
import { Button, Card } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { venueApi, type VenueInvite } from '../../services/venueApi'

/** Venues that invited this performer. Accepting lets them start sessions on that venue's devices. */
export function VenueInvites({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useFeedback()
  const [invites, setInvites] = useState<VenueInvite[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const res = await venueApi.invites()
    setInvites(Array.isArray(res.data) ? res.data : [])
  }
  useEffect(() => {
    void load()
  }, [])

  if (invites.length === 0) return null

  const respond = async (inv: VenueInvite, accept: boolean) => {
    setBusy(inv.linkId)
    const res = await venueApi.respond(inv.linkId, accept ? 'accept' : 'decline')
    setBusy(null)
    if (res.error) toast(res.error, 'error')
    else toast(accept ? `You can now use ${inv.venue.name}'s devices` : 'Invitation declined', 'success')
    await load()
    onChanged?.()
  }

  return (
    <Card title={invites.length === 1 ? 'A venue invited you' : `${invites.length} venues invited you`} subtitle="Accept to use their Tipwave devices when you play there." className="border-l-4 border-l-accent-500">
      <ul className="divide-y divide-slate-100">
        {invites.map(inv => (
          <li key={inv.linkId} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-ink-900">{inv.venue.name}</div>
              <div className="text-sm text-ink-500">{[inv.venue.city, inv.venue.state].filter(Boolean).join(', ')}</div>
            </div>
            <Button size="sm" variant="secondary" disabled={busy === inv.linkId} onClick={() => respond(inv, false)}>
              Decline
            </Button>
            <Button size="sm" loading={busy === inv.linkId} onClick={() => respond(inv, true)}>
              Accept
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
