import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ShowTotalsStrip } from '@/components/shows/ShowTotalsStrip'

const api = vi.hoisted(() => ({ current: vi.fn() }))
vi.mock('@/services/showApi', () => ({ showApi: api }))

const show = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: null, venueName: null, startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), isLive: true,
  tipCount: 7, gross: 142, waitingGross: 0, fees: 12.5, youKeep: 129.5, refundedCount: 0, refundedGross: 0, ...over
})

beforeEach(() => api.current.mockReset())
afterEach(() => vi.useRealTimers())

describe('ShowTotalsStrip, the night total on Live', () => {
  it('shows what the performer keeps, the tip count and the amount tipped', async () => {
    api.current.mockResolvedValue({ data: show() })
    render(<ShowTotalsStrip active />)

    expect(await screen.findByText('Tonight')).toBeInTheDocument()
    expect(screen.getByLabelText('You keep $129.50')).toBeInTheDocument()
    expect(screen.getByText('7 tips')).toBeInTheDocument()
    expect(screen.getByText('$142.00 tipped')).toBeInTheDocument()
  })

  it('says "1 tip" for one, and mentions tips not charged yet', async () => {
    api.current.mockResolvedValue({ data: show({ tipCount: 1, waitingGross: 20 }) })
    render(<ShowTotalsStrip active />)

    expect(await screen.findByText('1 tip')).toBeInTheDocument()
    expect(screen.getByText('$20.00 not charged yet')).toBeInTheDocument()
  })

  it('shows nothing when there is no show, or shows are off', async () => {
    api.current.mockResolvedValue({ data: null })
    const { container } = render(<ShowTotalsStrip active />)
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
  })

  it('asks nothing while Live is closed', async () => {
    render(<ShowTotalsStrip active={false} />)
    await act(async () => {})
    expect(api.current).not.toHaveBeenCalled()
  })

  it('updates as tips arrive, and keeps the last total when a refresh fails', async () => {
    vi.useFakeTimers()
    api.current.mockResolvedValueOnce({ data: show({ tipCount: 7, youKeep: 129.5 }) })
    render(<ShowTotalsStrip active refreshMs={1000} />)
    await act(async () => {})
    expect(screen.getByText('7 tips')).toBeInTheDocument()

    api.current.mockResolvedValueOnce({ data: show({ tipCount: 8, youKeep: 140 }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByText('8 tips')).toBeInTheDocument()
    expect(screen.getByLabelText('You keep $140.00')).toBeInTheDocument()

    api.current.mockRejectedValueOnce(new Error('network'))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByText('8 tips')).toBeInTheDocument()
  })

  it('shows a show the performer picked from its own totals, without asking for the current one', async () => {
    render(<ShowTotalsStrip active picked={show({ isLive: false, tipCount: 30, youKeep: 410 }) as any} />)

    expect(screen.getByText('This show')).toBeInTheDocument()
    expect(screen.getByText('30 tips')).toBeInTheDocument()
    expect(api.current).not.toHaveBeenCalled()
  })
})
