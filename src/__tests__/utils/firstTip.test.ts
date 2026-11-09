import { describe, it, expect } from 'vitest'
import { decideTap, tipText } from '@/utils/firstTip'

describe('what a tap on an amount does', () => {
  it('a tipper with a saved card sends the tip at once', () => {
    expect(decideTap({ ready: true, hasCard: true })).toBe('send')
  })
  it('a first-time tipper is asked for a card, and nothing is sent', () => {
    expect(decideTap({ ready: true, hasCard: false })).toBe('ask-for-card')
  })
  it('the moment the card is saved, the held tip is sent, even before the page knows about the card', () => {
    expect(decideTap({ ready: true, hasCard: false, cardJustSaved: true })).toBe('send')
  })
  it('nothing happens until the page is ready', () => {
    expect(decideTap({ ready: false, hasCard: false })).toBe('wait')
    expect(decideTap({ ready: false, hasCard: true })).toBe('wait')
  })
  it('writes whole dollars without cents', () => {
    expect(tipText(5)).toBe('$5')
    expect(tipText(2.5)).toBe('$2.50')
  })
})
