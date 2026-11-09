import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TipsTab from '@/components/portal/TipsTab'

const api = vi.hoisted(() => ({ getTipHistory: vi.fn() }))
const refunds = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@/services/refundRequestApi', async () => {
  const actual: any = await vi.importActual('@/services/refundRequestApi')
  return { ...actual, refundRequestApi: { ...actual.refundRequestApi, create: refunds.create } }
})
vi.mock('@/services/api', () => ({ apiService: api, default: api }))

const tip = (id: string, over: Record<string, unknown> = {}) => ({
  id, deviceId: 'd1', amount: 10, status: 'processed', createdAt: '2026-11-01T01:00:00Z', fees: 1.09, youKeep: 8.91, reason: null, ...over
})
const summary = { tipCount: 2, tipsGross: 15, waitingGross: 5, fees: 1.09, youKeep: 8.91, notChargedCount: 1, notChargedGross: 2 }
const devices = [{ id: 'd1', nickname: 'Patio' }, { id: 'd2', nickname: 'Stage' }]

const renderTab = (props: Partial<React.ComponentProps<typeof TipsTab>> = {}) =>
  render(<TipsTab profileId="p1" devices={devices} onGoToDevices={vi.fn()} {...props} />)

describe('TipsTab', () => {
  beforeEach(() => {
    api.getTipHistory.mockReset()
    api.getTipHistory.mockResolvedValue({ data: { items: [tip('a'), tip('b', { amount: 5, status: 'pending', fees: 0, youKeep: 0 })], total: 2, summary } })
  })

  it('shows tips, with the totals under the same names used elsewhere', async () => {
    renderTab()
    expect(await screen.findAllByText(/^Patio · /)).toHaveLength(2)
    expect(screen.getByText('Tips')).toBeInTheDocument()
    expect(screen.getByText('Fees')).toBeInTheDocument()
    expect(screen.getByText('You keep')).toBeInTheDocument()
    expect(screen.getByText(/waiting to be charged/i)).toBeInTheDocument()
    expect(screen.getByText('Charged', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Waiting', { selector: 'span' })).toBeInTheDocument()
  })

  it('keeps the extra filters and the download folded on a phone until asked for', async () => {
    renderTab()
    await screen.findAllByText(/^Patio · /)
    const toggle = screen.getByRole('button', { name: /more filters and download/i })
    expect(toggle.textContent).not.toMatch(/\bon$/) // nothing is filtered, so no "on" marker
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /fewer filters/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /download csv/i })).toBeInTheDocument()
  })

  it('shows a refunded tip struck through and marked, and says it is not counted', async () => {
    api.getTipHistory.mockResolvedValue({
      data: {
        items: [tip('r', { amount: 100, status: 'refunded', fees: 0, youKeep: 0, refundedAt: '2026-11-07T15:00:00Z' })],
        total: 1,
        summary: { ...summary, refundedCount: 1, refundedGross: 100 }
      }
    })
    renderTab()

    expect(await screen.findByText('Refunded', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText(/Refunded to the tipper on Nov 7/)).toBeInTheDocument()
    expect(screen.getByText(/1 tip \(\$100\.00\) was refunded to the tipper and is not counted above/)).toBeInTheDocument()
    expect(screen.queryByText(/You keep \$/)).toBeNull()
  })

  it('asks the server again when the status filter changes, and for the chosen device', async () => {
    renderTab()
    await screen.findByText('Tips')
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } })
    await waitFor(() => expect(api.getTipHistory).toHaveBeenLastCalledWith('p1', expect.objectContaining({ status: 'failed', page: 1 })))
    fireEvent.change(screen.getByLabelText('Device'), { target: { value: 'd2' } })
    await waitFor(() => expect(api.getTipHistory).toHaveBeenLastCalledWith('p1', expect.objectContaining({ deviceId: 'd2' })))
  })

  it('loads the next page when asked, keeping the first', async () => {
    api.getTipHistory.mockResolvedValueOnce({ data: { items: [tip('a')], total: 2, summary } })
    api.getTipHistory.mockResolvedValueOnce({ data: { items: [tip('b', { amount: 20 })], total: 2, summary } })
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /show more/i }))
    await waitFor(() => expect(api.getTipHistory).toHaveBeenLastCalledWith('p1', expect.objectContaining({ page: 2 })))
    expect(await screen.findByText('$20.00')).toBeInTheDocument()
    expect(screen.getByText('$10.00')).toBeInTheDocument()
  })

  it('offers one next step when there are no tips: widen to 30 days', async () => {
    api.getTipHistory.mockResolvedValue({ data: { items: [], total: 0, summary: { ...summary, tipCount: 0 } } })
    renderTab()
    expect(await screen.findByText('No tips in this range')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show last 30 days/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('with no device, the one next step is to add one', async () => {
    api.getTipHistory.mockResolvedValue({ data: { items: [], total: 0, summary } })
    const go = vi.fn()
    renderTab({ devices: [], onGoToDevices: go })
    fireEvent.click(await screen.findByRole('button', { name: /add a device/i }))
    expect(go).toHaveBeenCalled()
  })

  it('shows the plain reason on a tip that was not charged', async () => {
    api.getTipHistory.mockResolvedValue({ data: { items: [tip('f', { status: 'failed', fees: 0, youKeep: 0, reason: "The tipper's bank declined the card. No money was taken." })], total: 1, summary } })
    renderTab()
    expect(await screen.findByText(/bank declined the card/i)).toBeInTheDocument()
    expect(screen.getByText('Not charged', { selector: 'span' })).toBeInTheDocument()
  })

  describe('requesting a refund', () => {
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString()
    const withTips = (items: unknown[]) =>
      api.getTipHistory.mockResolvedValue({ data: { items, total: items.length, summary: { ...summary, notChargedCount: 0 } } })

    beforeEach(() => refunds.create.mockReset())

    it('offers Request refund only on a charged tip from the last 7 days with nothing asked yet', async () => {
      withTips([
        tip('ok', { createdAt: hoursAgo(5), amount: 50 }),
        tip('old', { createdAt: hoursAgo(24 * 9), amount: 20 }),
        tip('refunded', { createdAt: hoursAgo(5), status: 'refunded', fees: 0, youKeep: 0, amount: 100 }),
        tip('waiting', { createdAt: hoursAgo(1), status: 'pending', fees: 0, youKeep: 0, amount: 5 }),
        tip('asked', { createdAt: hoursAgo(6), refundRequest: 'pending', amount: 10 }),
        tip('declined', { createdAt: hoursAgo(7), refundRequest: 'declined', amount: 2 })
      ])
      renderTab()

      await screen.findByText('$50.00')
      expect(screen.getAllByRole('button', { name: /Request a refund/ })).toHaveLength(1)
      expect(screen.getByRole('button', { name: /Request a refund for the \$50\.00 tip/ })).toBeInTheDocument()
      expect(screen.getByText('Refund requested')).toBeInTheDocument()
      expect(screen.getByText('Not refunded')).toBeInTheDocument()
    })

    it('sends the request for that tip, then shows it as requested without reloading', async () => {
      withTips([tip('ok', { createdAt: hoursAgo(5), amount: 50 })])
      refunds.create.mockResolvedValue({ data: { status: 'pending' } })
      renderTab()

      fireEvent.click(await screen.findByRole('button', { name: /Request a refund for the \$50\.00 tip/ }))
      fireEvent.click(await screen.findByRole('button', { name: 'Send request' }))

      await waitFor(() => expect(refunds.create).toHaveBeenCalledWith(expect.objectContaining({ tipId: 'ok', reason: 'mistake' })))
      expect(await screen.findByText('Refund requested')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Request a refund/ })).toBeNull()
      expect(api.getTipHistory).toHaveBeenCalledTimes(1)
    })
  })
})
