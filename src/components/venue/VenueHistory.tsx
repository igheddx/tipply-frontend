import { useEffect, useState } from 'react'
import { Button, Card, EmptyState } from '../ui'
import { venueApi, type VenueProfile, type VenueSession } from '../../services/venueApi'
import { PerformerChip } from './PerformerChip'
import { LocationNote } from './LocationNote'
import { END_REASON_LABEL, STATE_LABEL, dayAndTime } from '../../utils/venueTime'

const PAGE = 20

const HOW_STARTED: Record<string, string> = {
  self: 'Started by themselves, confirmed at the venue',
  approval: 'You approved it',
  venue: 'You started it'
}

const lengthLabel = (s: VenueSession) => {
  const end = s.endedAt ? new Date(s.endedAt) : new Date(s.graceEndsAt)
  const mins = Math.max(0, Math.round((Math.min(end.getTime(), new Date(s.graceEndsAt).getTime()) - new Date(s.startsAt).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h} h ${mins % 60} min` : `${mins} min`
}

/** Who used which device and when. Tip counts only: a venue never sees what a performer earned. */
export function VenueHistory({ venue, refreshKey }: { venue: VenueProfile; refreshKey: number }) {
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<VenueSession[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    venueApi.history(page, PAGE).then(res => {
      if (cancelled) return
      setLoading(false)
      if (res.data) {
        setItems(res.data.items ?? [])
        setTotal(res.data.total ?? 0)
      }
    })
    return () => {
      cancelled = true
    }
  }, [page, refreshKey])

  if (!loading && items.length === 0) {
    return (
      <Card>
        <EmptyState icon="clock" title="No sessions yet">
          Each time a performer uses one of your devices it is recorded here.
        </EmptyState>
      </Card>
    )
  }

  return (
    <Card title="Session history" subtitle="Newest first." flush>
      <ul className="divide-y divide-slate-100 px-5 pb-2">
        {items.map(s => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <PerformerChip performer={s.performer} sub={`${s.deviceName} · ${dayAndTime(s.startsAt, venue.timeZoneId)}`} />
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold text-ink-900">
                {s.tipCount} {s.tipCount === 1 ? 'tip' : 'tips'} · {lengthLabel(s)}
              </div>
              <div className="text-xs text-ink-500">{s.endReason ? END_REASON_LABEL[s.endReason] ?? s.endReason : STATE_LABEL[s.state] ?? s.state}</div>
              {s.authorisedBy && HOW_STARTED[s.authorisedBy] && <div className="text-xs text-ink-400">{HOW_STARTED[s.authorisedBy]}</div>}
              {s.requestedBy === 'performer' && <LocationNote session={s} />}
            </div>
          </li>
        ))}
      </ul>
      {total > PAGE && (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <span className="text-sm text-ink-500">
            {(page - 1) * PAGE + 1} to {Math.min(page * PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page * PAGE >= total || loading} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
