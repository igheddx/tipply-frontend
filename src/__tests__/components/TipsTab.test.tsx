import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TipsTab from '@/components/portal/TipsTab'

const api = vi.hoisted(() => ({ getTipHistory: vi.fn() }))
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
})
