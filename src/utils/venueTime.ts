/** Time helpers for venue sessions. Times arrive as UTC strings; people see them in the venue's own time zone. */

const parts = (iso: string, timeZone?: string | null, opts: Intl.DateTimeFormatOptions = {}) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timeZone || undefined, ...opts }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('en-US', opts).format(new Date(iso))
  }
}

export const timeOnly = (iso: string, tz?: string | null) => parts(iso, tz, { hour: 'numeric', minute: '2-digit' })
export const dayAndTime = (iso: string, tz?: string | null) => parts(iso, tz, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** "Sat, Nov 8, 7:00 PM to 11:00 PM" */
export const windowLabel = (startsAt: string, endsAt: string, tz?: string | null) => `${dayAndTime(startsAt, tz)} to ${timeOnly(endsAt, tz)}`

/** "1 h 5 min", "42 min", "now" */
export const untilLabel = (iso: string, now = Date.now()) => {
  const mins = Math.round((new Date(iso).getTime() - now) / 60000)
  if (mins <= 0) return 'now'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Converts a value from <input type="datetime-local"> (the user's local time) into a UTC ISO string. */
export const localInputToIso = (value: string) => (value ? new Date(value).toISOString() : undefined)

/** The value an <input type="datetime-local"> expects for a Date, in local time. */
export const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const STATE_LABEL: Record<string, string> = {
  requested: 'Waiting for approval',
  upcoming: 'Booked',
  active: 'Performing now',
  grace: 'Finishing up',
  ended: 'Ended',
  denied: 'Declined',
  cancelled: 'Cancelled'
}

export const END_REASON_LABEL: Record<string, string> = {
  expired: 'Time ran out',
  performer: 'Ended by the performer',
  venue: 'Ended by the venue',
  suspended: 'Venue suspended',
  link_removed: 'Access turned off',
  replaced: 'Next performer started',
  denied: 'Declined',
  admin: 'Ended by Tipwave'
}
