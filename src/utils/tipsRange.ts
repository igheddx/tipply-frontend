/**
 * Date ranges for the Tips tab. Ranges follow the performer's own calendar (their device's time zone), so "Today"
 * means since their local midnight, not since midnight UTC. `to` is exclusive.
 */
export type RangePreset = 'today' | '7d' | '30d' | 'month' | 'custom'

export const MAX_RANGE_DAYS = 400

export interface TipsRange {
  from: Date
  to: Date
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** "YYYY-MM-DD" from a date input, as local midnight. Null when it is not a real date. */
export const parseDateInput = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null
}

export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The range for a preset, or null for a custom range that is empty, backwards or too long. */
export function rangeFor(preset: RangePreset, now: Date, customFrom = '', customTo = ''): TipsRange | null {
  const tomorrow = addDays(startOfDay(now), 1)
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: tomorrow }
    case '7d':
      return { from: addDays(startOfDay(now), -6), to: tomorrow }
    case '30d':
      return { from: addDays(startOfDay(now), -29), to: tomorrow }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: tomorrow }
    case 'custom': {
      const from = parseDateInput(customFrom)
      const lastDay = parseDateInput(customTo)
      if (!from || !lastDay) return null
      const to = addDays(lastDay, 1)
      if (from >= to) return null
      const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
      return days > MAX_RANGE_DAYS ? null : { from, to }
    }
  }
}
