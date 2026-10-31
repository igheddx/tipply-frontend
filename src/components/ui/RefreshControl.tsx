import { Button } from './Button'

interface RefreshControlProps {
  onRefresh: () => void
  busy: boolean
  /** When the data was last loaded, shown beside the button so it is clear the numbers are current */
  updatedAt?: Date | null
}

/** A "Refresh" button for the top right of a page, with the time of the last update next to it. */
export function RefreshControl({ onRefresh, busy, updatedAt }: RefreshControlProps) {
  return (
    <div className="flex items-center gap-3">
      {updatedAt && (
        <span className="hidden text-xs text-ink-500 sm:inline">
          Updated {updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      )}
      <Button variant="secondary" size="sm" icon="refresh" onClick={onRefresh} loading={busy} aria-label="Refresh this page">
        Refresh
      </Button>
    </div>
  )
}
