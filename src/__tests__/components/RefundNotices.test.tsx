import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { TipperRefundNotice } from '@/components/tip/TipperRefundNotice'
import { RefundNoticeBanner } from '@/components/portal/RefundNoticeBanner'

const api = vi.hoisted(() => ({ forTipper: vi.fn(), tipperSeen: vi.fn(), forPerformer: vi.fn(), performerSeen: vi.fn() }))
vi.mock('@/services/refundNoticeApi', () => ({ refundNoticeApi: api }))

const notice = (id: string, amount = 100, name = 'Dave Lovett Piano') => ({ id, amount, refundedAt: '2026-11-07T15:00:00Z', performerName: name })

describe('TipperRefundNotice', () => {
  beforeEach(() => {
    Object.values(api).forEach(f => f.mockReset())
    api.tipperSeen.mockResolvedValue(undefined)
    api.performerSeen.mockResolvedValue({})
  })

  it('shows nothing when there is no refund to tell about', async () => {
    api.forTipper.mockResolvedValue({ notices: [], totalAmount: 0 })
    const { container } = render(<TipperRefundNotice userId="u1" />)
    await waitFor(() => expect(api.forTipper).toHaveBeenCalledWith('u1'))
    expect(container).toBeEmptyDOMElement()
  })

  it('does not ask until the tipper id is known', () => {
    render(<TipperRefundNotice userId="" />)
    expect(api.forTipper).not.toHaveBeenCalled()
  })

  it('adds up several refunds into one calm message, with no offer to tip again', async () => {
    api.forTipper.mockResolvedValue({ notices: [notice('a'), notice('b')], totalAmount: 200 })
    render(<TipperRefundNotice userId="u1" />)

    expect(await screen.findByText('Your tips were refunded')).toBeInTheDocument()
    expect(screen.getByText('$200.00')).toBeInTheDocument()
    expect(screen.getByText(/5 to 10 business days/)).toBeInTheDocument()
    expect(screen.queryByText(/tip again/i)).toBeNull()
  })

  it('marks every refund as seen when the tipper taps Got it, and closes', async () => {
    api.forTipper.mockResolvedValue({ notices: [notice('a'), notice('b')], totalAmount: 200 })
    render(<TipperRefundNotice userId="u1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Got it' }))

    expect(api.tipperSeen).toHaveBeenCalledWith('u1', ['a', 'b'])
    expect(screen.queryByText('Your tips were refunded')).toBeNull()
  })

  it('closing with the X does not count as acknowledged, so it comes back next visit', async () => {
    api.forTipper.mockResolvedValue({ notices: [notice('a')], totalAmount: 100 })
    render(<TipperRefundNotice userId="u1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))

    expect(api.tipperSeen).not.toHaveBeenCalled()
    expect(screen.queryByText('Your tip was refunded')).toBeNull()
  })
})

describe('RefundNoticeBanner (performer)', () => {
  beforeEach(() => {
    Object.values(api).forEach(f => f.mockReset())
    api.performerSeen.mockResolvedValue({})
  })

  it('shows nothing when there is nothing new', async () => {
    api.forPerformer.mockResolvedValue({ notices: [], totalAmount: 0 })
    const { container } = render(<RefundNoticeBanner onView={() => {}} />)
    await waitFor(() => expect(api.forPerformer).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('opens the Tips list and clears itself for good when viewed', async () => {
    api.forPerformer.mockResolvedValue({ notices: [notice('a')], totalAmount: 100 })
    const onView = vi.fn()
    render(<RefundNoticeBanner onView={onView} />)

    expect(await screen.findByText('A $100.00 tip was refunded')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'See your tips' }))

    expect(onView).toHaveBeenCalled()
    expect(api.performerSeen).toHaveBeenCalledWith(['a'])
    expect(screen.queryByText('A $100.00 tip was refunded')).toBeNull()
  })
})
