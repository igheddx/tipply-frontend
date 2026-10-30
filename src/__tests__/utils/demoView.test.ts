import { describe, it, expect, beforeEach } from 'vitest'
import { setDemoModeOn, setShowDemoData, wantsDemoData, demoQuery } from '../../utils/demoView'

describe('demo view', () => {
  beforeEach(() => {
    setDemoModeOn(false)
  })

  it('asks for real data by default', () => {
    expect(wantsDemoData()).toBe(false)
    expect(demoQuery('?')).toBe('')
  })

  it('asks for demo data only when demo mode is on and the performer chose it', () => {
    setShowDemoData(true) // demo mode is off, so this does nothing
    expect(wantsDemoData()).toBe(false)

    setDemoModeOn(true)
    expect(wantsDemoData()).toBe(false)
    setShowDemoData(true)
    expect(wantsDemoData()).toBe(true)
    expect(demoQuery('?')).toBe('?demo=true')
    expect(demoQuery('&')).toBe('&demo=true')
  })

  it('goes back to real data when demo mode ends', () => {
    setDemoModeOn(true)
    setShowDemoData(true)
    setDemoModeOn(false)
    expect(wantsDemoData()).toBe(false)
    setDemoModeOn(true)
    expect(wantsDemoData()).toBe(false) // does not silently come back on
  })
})
