import type { ShowSummary } from '../services/showApi'

const dayLabel = (d: Date) =>
  `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
const timeLabel = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '')
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** The name shown when the performer has not chosen one: "Fri Nov 7 show", dated by when it started. */
export const defaultShowName = (show: Pick<ShowSummary, 'startedAt'>) => `${dayLabel(new Date(show.startedAt))} show`

/**
 * What to call a show. The performer's own name wins. Otherwise it is "Fri Nov 7 show"; when another show in the
 * same list started earlier the same day, this later one is told apart by its time: "Fri Nov 7, 2 pm show".
 */
export function showTitle(show: ShowSummary, all: ShowSummary[] = []): string {
  if (show.name) return show.name
  const start = new Date(show.startedAt)
  const earlierSameDay = all.some(o => o.id !== show.id && !o.name && new Date(o.startedAt) < start && sameDay(new Date(o.startedAt), start))
  return earlierSameDay ? `${dayLabel(start)}, ${timeLabel(start)} show` : defaultShowName(show)
}

/** "9 pm to 1:20 am", or "9 pm, still going" */
export function showTimes(show: ShowSummary): string {
  const start = new Date(show.startedAt)
  const end = new Date(show.endedAt)
  const startText = timeLabel(start)
  if (show.isLive) return `${startText} to now`
  const endText = timeLabel(end)
  return sameDay(start, end) ? `${startText} to ${endText}` : `${startText} to ${endText} the next day`
}
