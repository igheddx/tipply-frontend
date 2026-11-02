import { describe, it, expect } from 'vitest'
import { rangeFor, parseDateInput, toDateInput } from '../../utils/tipsRange'

describe('Tips tab date ranges', () => {
  const now = new Date(2026, 10, 1, 20, 30) // Nov 1, 8:30 pm local

  it('Today starts at the local midnight and ends at the next one', () => {
    const r = rangeFor('today', now)!
    expect(r.from).toEqual(new Date(2026, 10, 1))
    expect(r.to).toEqual(new Date(2026, 10, 2))
  })

  it('Last 7 days includes today and the six days before', () => {
    const r = rangeFor('7d', now)!
    expect(r.from).toEqual(new Date(2026, 9, 26))
    expect(r.to).toEqual(new Date(2026, 10, 2))
  })

  it('Last 30 days and This month', () => {
    expect(rangeFor('30d', now)!.from).toEqual(new Date(2026, 9, 3))
    expect(rangeFor('month', now)!.from).toEqual(new Date(2026, 10, 1))
  })

  it('a custom range includes its last day', () => {
    const r = rangeFor('custom', now, '2026-10-01', '2026-10-31')!
    expect(r.from).toEqual(new Date(2026, 9, 1))
    expect(r.to).toEqual(new Date(2026, 10, 1))
  })

  it('rejects empty, backwards, impossible and too-long custom ranges', () => {
    expect(rangeFor('custom', now, '', '')).toBeNull()
    expect(rangeFor('custom', now, '2026-10-31', '2026-10-01')).toBeNull()
    expect(rangeFor('custom', now, '2026-02-30', '2026-03-01')).toBeNull()
    expect(rangeFor('custom', now, '2024-01-01', '2026-10-31')).toBeNull()
  })

  it('parses and formats date inputs', () => {
    expect(parseDateInput('not a date')).toBeNull()
    expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
