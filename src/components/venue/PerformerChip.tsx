import { photoSrc } from '../../utils/photoUrl'
import type { PerformerCard } from '../../services/venueApi'

/** A performer's photo (or initial) and name. */
export function PerformerChip({ performer, size = 36, sub }: { performer: PerformerCard; size?: number; sub?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {performer.photoUrl ? (
        <img src={photoSrc(performer.photoUrl)} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
      ) : (
        <span
          className="flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
          aria-hidden="true"
        >
          {(performer.displayName.trim().charAt(0) || '?').toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate font-semibold text-ink-900">{performer.displayName}</div>
        {sub && <div className="truncate text-xs text-ink-500">{sub}</div>}
      </div>
    </div>
  )
}
