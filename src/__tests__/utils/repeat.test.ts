import { describe, it, expect } from 'vitest'
import { percent, cohortText, cohortFor, daysText } from '@/utils/repeat'

describe('repeat helpers', () => {
  it('shows a dash, never 0%, when there is nobody to measure', () => {
    expect(percent(0, 0)).toBe('–')
    expect(percent(3, 0)).toBe('–')
    expect(percent(0, 4)).toBe('0%')
  })

  it('rounds to a whole percent', () => {
    expect(percent(1, 3)).toBe('33%')
    expect(percent(2, 3)).toBe('67%')
    expect(percent(4, 4)).toBe('100%')
  })

  it('describes a window only when somebody has been around long enough', () => {
    expect(cohortText({ days: 30, eligible: 0, returned: 0 })).toBeNull()
    expect(cohortText(undefined)).toBeNull()
    expect(cohortText({ days: 30, eligible: 10, returned: 4 })).toBe('40% (4 of 10)')
  })

  it('finds a window by its length', () => {
    const cohorts = [{ days: 7, eligible: 1, returned: 0 }, { days: 30, eligible: 2, returned: 1 }]
    expect(cohortFor(cohorts, 30)?.eligible).toBe(2)
    expect(cohortFor(cohorts, 90)).toBeUndefined()
  })

  it('says the typical time to come back in plain words', () => {
    expect(daysText(null)).toBeNull()
    expect(daysText(0.4)).toBe('the same week')
    expect(daysText(1)).toBe('1 day')
    expect(daysText(6.6)).toBe('7 days')
  })
})
