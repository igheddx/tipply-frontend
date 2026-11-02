import { describe, it, expect } from 'vitest'
import { buildTipsCsv, csvCell } from '../../utils/tipsCsv'

describe('Tips CSV', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Bob, "the" Bar')).toBe('"Bob, ""the"" Bar"')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell('plain')).toBe('plain')
  })

  it('defuses text that a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`)
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-2')).toBe("'-2")
    expect(csvCell('@sum')).toBe("'@sum")
  })

  it('leaves real numbers alone', () => {
    expect(csvCell(-2.5)).toBe('-2.5')
  })

  it('writes a header, one row per tip, and money to two decimals', () => {
    const csv = buildTipsCsv([
      { amount: 10, status: 'processed', createdAt: '2026-11-01T01:00:00Z', fees: 1.09, youKeep: 8.91, deviceName: 'Patio' },
      { amount: 5, status: 'pending', createdAt: '2026-11-01T02:00:00Z', fees: 0, youKeep: 0, deviceName: '=cmd' },
      { amount: 2, status: 'failed', createdAt: '2026-11-01T03:00:00Z', fees: 0, youKeep: 0, deviceName: 'Patio', reason: 'The tipper\'s bank declined the card. No money was taken.' }
    ])
    const lines = csv.replace('﻿', '').trim().split('\r\n')
    expect(lines[0]).toBe('Date and time,Device,Tip (gross),Status,Fees,You keep,Note')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toMatch(/,Patio,10\.00,Charged,1\.09,8\.91,$/)
    expect(lines[2]).toContain(",'=cmd,5.00,Waiting,,,Charged in the next batch")
    expect(lines[3]).toContain('2.00,Not charged,,,')
    expect(csv.startsWith('﻿')).toBe(true)
  })
})
