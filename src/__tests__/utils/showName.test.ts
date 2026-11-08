import { describe, it, expect } from 'vitest'
import { defaultShowName, showTitle, showTimes } from '@/utils/showName'
import type { ShowSummary } from '@/services/showApi'

const show = (over: Partial<ShowSummary> = {}): ShowSummary => ({
  id: 's1', name: null, venueName: null, startedAt: '2026-11-07T21:00:00', endedAt: '2026-11-08T01:20:00', isLive: false,
  tipCount: 3, gross: 50, waitingGross: 0, fees: 4, youKeep: 46, refundedCount: 0, refundedGross: 0, ...over
})

describe('show names', () => {
  it('is dated by when the show started, so a set past midnight keeps the day it began', () => {
    expect(defaultShowName(show())).toBe('Sat Nov 7 show')
  })

  it("the performer's own name always wins", () => {
    expect(showTitle(show({ name: "Friday at Joe's" }))).toBe("Friday at Joe's")
  })

  it('tells a later show on the same day apart by its time', () => {
    const evening = show({ id: 'e', startedAt: '2026-11-07T21:00:00' })
    const daytime = show({ id: 'd', startedAt: '2026-11-07T14:00:00' })
    expect(showTitle(daytime, [evening, daytime])).toBe('Sat Nov 7 show')
    expect(showTitle(evening, [evening, daytime])).toBe('Sat Nov 7, 9 PM show')
  })

  it('describes the times, noting the next day and a live show', () => {
    expect(showTimes(show())).toBe('9 PM to 1:20 AM the next day')
    expect(showTimes(show({ endedAt: '2026-11-07T23:00:00' }))).toBe('9 PM to 11 PM')
    expect(showTimes(show({ isLive: true }))).toBe('9 PM to now')
  })
})
