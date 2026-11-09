import { describe, it, expect } from 'vitest'
import { tipPalette, isTestSite } from '@/utils/tipTheme'

describe('tip page palette', () => {
  it('production keeps its teal-navy exactly', () => {
    const p = tipPalette('R11.26.001', 'app.tipwave.live')
    expect(p.test).toBe(false)
    expect([p.top, p.mid, p.bottom]).toEqual(['#0a2533', '#0d4254', '#0f3447'])
  })
  it('a test build is plum', () => {
    const p = tipPalette('T11.26.062', 'apptest.tipwave.live')
    expect(p.test).toBe(true)
    expect([p.top, p.mid, p.bottom]).toEqual(['#26091f', '#4a1740', '#3a1233'])
  })
  it('the test address is plum even if the version is missing', () => {
    expect(isTestSite(undefined, 'apptest.tipwave.live')).toBe(true)
  })
  it('production is never plum: a release version on the live address, or a local run', () => {
    expect(isTestSite('R11.26.001', 'app.tipwave.live')).toBe(false)
    expect(isTestSite('dev', 'localhost')).toBe(false)
    expect(isTestSite(undefined, 'app.tipwave.live')).toBe(false)
  })
})
