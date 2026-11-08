import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AdminPerformerShows } from '@/components/shows/AdminPerformerShows'
import { AdminPerformerPanel } from '@/components/shows/AdminPerformerPanel'

const api = vi.hoisted(() => ({ adminShows: vi.fn(), adminShowRequests: vi.fn() }))
vi.mock('@/services/showApi', () => ({ showApi: api }))
vi.mock('@/components/PerformerSongRequests', async () => {
  const actual: any = await vi.importActual('@/components/PerformerSongRequests')
  return { ...actual, default: () => <div>By day view</div> }
})

const show = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: null, venueName: "Joe's Bar", startedAt: '2026-11-07T21:00:00', endedAt: '2026-11-08T01:20:00', isLive: true,
  tipCount: 4, gross: 135, waitingGross: 0, fees: 10, youKeep: 125, refundedCount: 0, refundedGross: 0, ...over
})
const request = (id: string, title: string, over: Record<string, unknown> = {}) => ({ id, songTitle: title, artist: 'Artist', amount: 20, sentAt: '2026-11-08T00:10:00Z', status: 'pending', performed: false, requestorName: 'Pat', ...over })
const list = (shows: unknown[]) => ({ data: { shows, total: shows.length, page: 1, pageSize: 10 } })
const requests = (items: unknown[]) => ({ data: { total: items.length, performed: 1, totalAmount: 45, page: 1, pageSize: 10, items } })

beforeEach(() => {
  api.adminShows.mockReset()
  api.adminShowRequests.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('AdminPerformerShows', () => {
  it('shows how the performer’s show is going and the song requests that came in during it', async () => {
    api.adminShows.mockResolvedValue(list([show()]))
    api.adminShowRequests.mockResolvedValue(requests([request('r1', 'Redemption Song'), request('r2', 'Free Bird', { performed: true })]))
    render(<AdminPerformerShows profileId="p1" />)

    expect(await screen.findByTestId('admin-show-total')).toHaveTextContent('$135.00')
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText(/Joe's Bar/)).toBeInTheDocument()
    expect(await screen.findByText('Redemption Song')).toBeInTheDocument()
    expect(screen.getByText(/2 requested · 1 performed · \$45\.00 in tips/)).toBeInTheDocument()
    expect(api.adminShowRequests).toHaveBeenCalledWith('p1', 's1', 1, 10)
  })

  it('switches to an earlier show and asks for that show’s requests', async () => {
    api.adminShows.mockResolvedValue(list([show(), show({ id: 's0', isLive: false, startedAt: '2026-11-06T21:00:00', endedAt: '2026-11-06T23:30:00', gross: 80 })]))
    api.adminShowRequests.mockResolvedValue(requests([request('r1', 'Song')]))
    render(<AdminPerformerShows profileId="p1" />)
    await screen.findByTestId('admin-show-total')

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 's0' } })

    await waitFor(() => expect(api.adminShowRequests).toHaveBeenLastCalledWith('p1', 's0', 1, 10))
    expect(await screen.findByText('$80.00')).toBeInTheDocument()
  })

  it('says so when the performer has no shows yet', async () => {
    api.adminShows.mockResolvedValue(list([]))
    render(<AdminPerformerShows profileId="p1" />)
    expect(await screen.findByText(/No shows yet/)).toBeInTheDocument()
  })

  it('says so when the shows cannot be loaded', async () => {
    api.adminShows.mockResolvedValue({ error: 'nope' })
    render(<AdminPerformerShows profileId="p1" />)
    expect(await screen.findByText(/Could not load this performer's shows/)).toBeInTheDocument()
  })

  it('names refunded tips and does not count them', async () => {
    api.adminShows.mockResolvedValue(list([show({ refundedCount: 2, refundedGross: 200 })]))
    api.adminShowRequests.mockResolvedValue(requests([]))
    render(<AdminPerformerShows profileId="p1" />)
    expect(await screen.findByText(/2 tips \(\$200\.00\) refunded to the tipper and not counted/)).toBeInTheDocument()
    expect(await screen.findByText('No song requests in this show')).toBeInTheDocument()
  })

  it('refreshes by itself every 15 seconds while the show is live', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.adminShows.mockResolvedValue(list([show()]))
    api.adminShowRequests.mockResolvedValue(requests([request('r1', 'Song')]))
    render(<AdminPerformerShows profileId="p1" />)
    await screen.findByTestId('admin-show-total')
    const before = api.adminShows.mock.calls.length

    await act(async () => { vi.advanceTimersByTime(15500) })

    expect(api.adminShows.mock.calls.length).toBeGreaterThan(before)
  })

  it('does not keep refreshing a show that has ended', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.adminShows.mockResolvedValue(list([show({ isLive: false })]))
    api.adminShowRequests.mockResolvedValue(requests([]))
    render(<AdminPerformerShows profileId="p1" />)
    await screen.findByTestId('admin-show-total')
    const before = api.adminShows.mock.calls.length

    await act(async () => { vi.advanceTimersByTime(60000) })

    expect(api.adminShows.mock.calls.length).toBe(before)
  })
})

describe('AdminPerformerPanel', () => {
  it('opens on Shows, and keeps the day view one tap away', async () => {
    api.adminShows.mockResolvedValue(list([show()]))
    api.adminShowRequests.mockResolvedValue(requests([]))
    render(<AdminPerformerPanel profileId="p1" />)

    expect(await screen.findByTestId('admin-show-total')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'By day' }))
    expect(screen.getByText('By day view')).toBeInTheDocument()
  })
})
