import { describe, it, expect } from 'vitest'
import { untilLabel, windowLabel, timeOnly, localInputToIso, toLocalInput } from '@/utils/venueTime'

describe('venue time helpers', () => {
  const now = new Date('2026-11-03T18:00:00Z').getTime()

  it('says how long is left in plain words', () => {
    expect(untilLabel('2026-11-03T18:00:00Z', now)).toBe('now')
    expect(untilLabel('2026-11-03T17:00:00Z', now)).toBe('now')
    expect(untilLabel('2026-11-03T18:42:00Z', now)).toBe('42 min')
    expect(untilLabel('2026-11-03T19:00:00Z', now)).toBe('1 h')
    expect(untilLabel('2026-11-03T19:05:00Z', now)).toBe('1 h 5 min')
  })

  it('shows times in the venue\'s own time zone, not the viewer\'s', () => {
    // 01:00 UTC on the 4th is 7 pm on the 3rd in Chicago (UTC-6 after the clocks go back)
    expect(timeOnly('2026-11-04T01:00:00Z', 'America/Chicago')).toBe('7:00 PM')
    expect(windowLabel('2026-11-04T01:00:00Z', '2026-11-04T05:00:00Z', 'America/Chicago')).toBe('Tue, Nov 3, 7:00 PM to 11:00 PM')
  })

  it('does not break on an unknown time zone', () => {
    expect(timeOnly('2026-11-04T01:00:00Z', 'Not/AZone')).toMatch(/\d{1,2}:\d{2}/)
  })

  it('turns a datetime-local value into UTC and back', () => {
    const local = '2026-11-03T19:30'
    const iso = localInputToIso(local)!
    expect(new Date(iso).getHours()).toBe(19)
    expect(toLocalInput(new Date(iso))).toBe(local)
    expect(localInputToIso('')).toBeUndefined()
  })
})
