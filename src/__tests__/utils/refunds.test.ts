import { describe, it, expect } from 'vitest'
import { isRefundEligible } from '@/utils/refunds'

describe('refund eligibility', () => {
  it('allows processed tips within 7 days with payment intent', () => {
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - 2)

    const eligible = isRefundEligible({
      status: 'processed',
      createdAt: createdAt.toISOString(),
      stripePaymentIntentId: 'pi_123'
    })

    expect(eligible).toBe(true)
  })

  it('rejects non-processed tips', () => {
    const createdAt = new Date().toISOString()

    const eligible = isRefundEligible({
      status: 'pending',
      createdAt,
      stripePaymentIntentId: 'pi_123'
    })

    expect(eligible).toBe(false)
  })

  it('rejects tips older than 7 days', () => {
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - 8)

    const eligible = isRefundEligible({
      status: 'processed',
      createdAt: createdAt.toISOString(),
      stripePaymentIntentId: 'pi_123'
    })

    expect(eligible).toBe(false)
  })

  it('rejects tips without a payment intent id', () => {
    const createdAt = new Date().toISOString()

    const eligible = isRefundEligible({
      status: 'processed',
      createdAt,
      stripePaymentIntentId: null
    })

    expect(eligible).toBe(false)
  })
})
