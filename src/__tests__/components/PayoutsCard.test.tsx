import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PayoutsCard from '../../components/PayoutsCard'

const NOW = new Date('2026-11-11T12:00:00Z')

describe('PayoutsCard', () => {
  it('shows the three stages of the money in order', () => {
    render(<PayoutsCard futurePayouts={487.22} availableToPayOut={0} inTransit={359.99} recentPayouts={[]} now={NOW} />)
    expect(screen.getByText('1. Pending (Future Payouts)')).toBeInTheDocument()
    expect(screen.getByText('$487.22')).toBeInTheDocument()
    expect(screen.getByText('2. Available to pay out')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
    expect(screen.getByText('3. In transit')).toBeInTheDocument()
    expect(screen.getByText('$359.99')).toBeInTheDocument()
  })

  it('lists the latest payouts with their status and date', () => {
    render(
      <PayoutsCard
        futurePayouts={0}
        availableToPayOut={0}
        inTransit={359.99}
        now={NOW}
        recentPayouts={[
          { status: 'in_transit', amount: 359.99, createdUtc: '2026-11-09T00:00:00Z', arrivalUtc: '2026-11-13T00:00:00Z' },
          { status: 'paid', amount: 120, createdUtc: '2026-10-20T00:00:00Z', arrivalUtc: '2026-10-22T00:00:00Z' },
        ]}
      />
    )
    expect(screen.getByText('In transit')).toBeInTheDocument()
    expect(screen.getByText(/Expected Nov 13, 2026/)).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.getByText(/Arrived Oct 22, 2026/)).toBeInTheDocument()
    expect(screen.queryByText(/Past its date/)).toBeNull()
  })

  it('flags a payout still in transit well after its expected date', () => {
    render(
      <PayoutsCard
        futurePayouts={0}
        availableToPayOut={0}
        inTransit={359.99}
        now={NOW}
        recentPayouts={[{ status: 'in_transit', amount: 359.99, createdUtc: '2026-11-01T00:00:00Z', arrivalUtc: '2026-11-05T00:00:00Z' }]}
      />
    )
    expect(screen.getByText(/Past its date: check Stripe/)).toBeInTheDocument()
  })

  it('shows a failed payout with its reason', () => {
    render(
      <PayoutsCard
        futurePayouts={0}
        availableToPayOut={0}
        inTransit={0}
        now={NOW}
        recentPayouts={[{ status: 'failed', amount: 50, createdUtc: '2026-11-01T00:00:00Z', arrivalUtc: '2026-11-03T00:00:00Z', failureCode: 'account_closed' }]}
      />
    )
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('account closed')).toBeInTheDocument()
  })

  it('says so when there are no payouts yet', () => {
    render(<PayoutsCard futurePayouts={10} availableToPayOut={0} inTransit={0} recentPayouts={[]} now={NOW} />)
    expect(screen.getByText(/No payouts yet/)).toBeInTheDocument()
  })

  it('says so when Stripe could not be read, instead of showing zeros as if they were real', () => {
    render(<PayoutsCard futurePayouts={10} availableToPayOut={null} inTransit={0} recentPayouts={null} now={NOW} />)
    expect(screen.getByText('Not available')).toBeInTheDocument()
    expect(screen.getByText(/could not be read from Stripe/)).toBeInTheDocument()
  })
})
