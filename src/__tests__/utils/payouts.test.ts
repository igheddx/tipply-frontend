import { describe, it, expect } from 'vitest'
import { readyToPayOut } from '../../utils/payouts'

describe('readyToPayOut', () => {
  it('is zero when all the money is still pending (the API total equals the pending part)', () => {
    expect(readyToPayOut({ stripeAvailableBalance: 487.22, stripeFuturePayouts: 487.22, stripeReadyToPayOut: 0 })).toBe(0)
  })

  it('uses the figure the API sends', () => {
    expect(readyToPayOut({ stripeAvailableBalance: 500, stripeFuturePayouts: 200, stripeReadyToPayOut: 300 })).toBe(300)
  })

  it('works from the total less the pending part when an older API does not send it', () => {
    expect(readyToPayOut({ stripeAvailableBalance: 500, stripeFuturePayouts: 200 })).toBe(300)
    expect(readyToPayOut({ stripeAvailableBalance: 487.22, stripeFuturePayouts: 487.22 })).toBe(0)
  })

  it('is never negative and is zero with no data', () => {
    expect(readyToPayOut({ stripeAvailableBalance: 10, stripeFuturePayouts: 25 })).toBe(0)
    expect(readyToPayOut({ stripeReadyToPayOut: -3 })).toBe(0)
    expect(readyToPayOut(null)).toBe(0)
    expect(readyToPayOut(undefined)).toBe(0)
  })
})
