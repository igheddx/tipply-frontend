import type { VenueSession } from '../../services/venueApi'

/**
 * How far from the venue the performer's phone said it was when they started, and how sure the phone was. Starts that were far
 * away or vague are marked so the venue knows to look twice. Shown to the venue only.
 */
export function LocationNote({ session }: { session: Pick<VenueSession, 'distanceMeters' | 'accuracyMeters' | 'locationDoubtful'> }) {
  if (session.distanceMeters == null) return null
  const text = `Phone was ${session.distanceMeters} m from the venue${session.accuracyMeters != null ? ` (GPS within ${session.accuracyMeters} m)` : ''}`
  return session.locationDoubtful ? (
    <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800" title="Far from the venue, or the phone was not sure where it was. Check this one.">
      Check: {text}
    </span>
  ) : (
    <span className="text-xs text-ink-400">{text}</span>
  )
}
