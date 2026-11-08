import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ShowCard } from '@/components/shows/ShowCard'
import { ShowsList } from '@/components/shows/ShowsList'
import { VenuePicker } from '@/components/shows/VenuePicker'

const api = vi.hoisted(() => ({
  current: vi.fn(), list: vi.fn(), startNew: vi.fn(), end: vi.fn(), update: vi.fn(), mergeIntoPrevious: vi.fn(), venues: vi.fn()
}))
vi.mock('@/services/showApi', () => ({ showApi: api }))
const feedback = vi.hoisted(() => ({ toast: vi.fn(), confirm: vi.fn(async () => true) }))
vi.mock('@/components/ui/Feedback', () => ({ useFeedback: () => feedback, FeedbackProvider: ({ children }: any) => children }))

const show = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: null, venueName: null, startedAt: '2026-11-07T21:00:00', endedAt: '2026-11-08T01:20:00', isLive: true,
  tipCount: 4, gross: 135, waitingGross: 0, fees: 10, youKeep: 125, refundedCount: 0, refundedGross: 0, ...over
})

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  feedback.toast.mockClear()
  feedback.confirm.mockClear().mockResolvedValue(true)
  api.venues.mockResolvedValue({ data: { venues: ["Joe's Bar", 'The Tap Room'] } })
})

describe('ShowCard', () => {
  it('shows what this show has made so far, across midnight', async () => {
    api.current.mockResolvedValue({ data: { show: show() } })
    render(<ShowCard />)

    expect(await screen.findByText('This show')).toBeInTheDocument()
    expect(screen.getByTestId('show-total')).toHaveTextContent('$135.00')
    expect(screen.getByText(/4 tips, before fees · You keep \$125\.00/)).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('names refunded tips and says they are not counted', async () => {
    api.current.mockResolvedValue({ data: { show: show({ refundedCount: 2, refundedGross: 200 }) } })
    render(<ShowCard />)
    expect(await screen.findByText(/2 tips \(\$200\.00\) refunded to the tipper and not counted/)).toBeInTheDocument()
  })

  it('starts a new show at $0 only after the performer confirms', async () => {
    api.current.mockResolvedValue({ data: { show: show() } })
    api.startNew.mockResolvedValue({ data: show({ id: 's2', tipCount: 0, gross: 0, youKeep: 0 }) })
    render(<ShowCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'New show' }))

    await waitFor(() => expect(feedback.confirm).toHaveBeenCalled())
    expect(await screen.findByText('$0.00')).toBeInTheDocument()
  })

  it('does not start a new show when the performer cancels', async () => {
    api.current.mockResolvedValue({ data: { show: show() } })
    feedback.confirm.mockResolvedValue(false)
    render(<ShowCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'New show' }))

    await waitFor(() => expect(feedback.confirm).toHaveBeenCalled())
    expect(api.startNew).not.toHaveBeenCalled()
  })

  it('offers a first show when there is none yet', async () => {
    api.current.mockResolvedValue({ data: { show: null } })
    render(<ShowCard />)
    expect(await screen.findByRole('button', { name: 'Start a show' })).toBeInTheDocument()
  })

  it('picks a venue from the recent places in one tap', async () => {
    api.current.mockResolvedValue({ data: { show: show() } })
    api.update.mockResolvedValue({ data: show({ venueName: "Joe's Bar" }) })
    render(<ShowCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add where you’re playing' }))
    fireEvent.click(await screen.findByRole('button', { name: "Joe's Bar" }))

    await waitFor(() => expect(api.update).toHaveBeenCalledWith('s1', { name: null, venueName: "Joe's Bar" }))
    expect(await screen.findByRole('button', { name: "Joe's Bar" })).toBeInTheDocument()
  })
})

describe('VenuePicker', () => {
  it('adds a typed place that is not in the list, and searches the ones that are', async () => {
    const onPick = vi.fn()
    render(<VenuePicker open current={null} onPick={onPick} onClose={() => {}} />)
    await screen.findByRole('button', { name: "Joe's Bar" })

    fireEvent.change(screen.getByLabelText('Search or add a place'), { target: { value: 'tap' } })
    expect(screen.queryByRole('button', { name: "Joe's Bar" })).toBeNull()
    expect(screen.getByRole('button', { name: 'The Tap Room' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search or add a place'), { target: { value: 'Blue Note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add “Blue Note”' }))
    expect(onPick).toHaveBeenCalledWith('Blue Note')
  })

  it('can remove the place', async () => {
    const onPick = vi.fn()
    render(<VenuePicker open current="Joe's Bar" onPick={onPick} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the place' }))
    expect(onPick).toHaveBeenCalledWith(null)
  })
})

describe('ShowsList', () => {
  const list = (shows: unknown[], total = shows.length) => ({ data: { shows, total, page: 1, pageSize: 20 } })

  it('lists each show with its own total, newest first', async () => {
    api.list.mockResolvedValue(list([show({ id: 'a', gross: 135 }), show({ id: 'b', isLive: false, startedAt: '2026-11-06T21:00:00', endedAt: '2026-11-06T23:30:00', gross: 80, tipCount: 2, venueName: "Joe's Bar" })]))
    render(<ShowsList />)

    expect(await screen.findByText('2 shows')).toBeInTheDocument()
    expect(screen.getByText('$135.00')).toBeInTheDocument()
    expect(screen.getByText('$80.00')).toBeInTheDocument()
    expect(screen.getByText(/Joe's Bar/)).toBeInTheDocument()
  })

  it('shows refunded tips on the show but not in its total', async () => {
    api.list.mockResolvedValue(list([show({ isLive: false, refundedCount: 1, refundedGross: 100 })]))
    render(<ShowsList />)
    expect(await screen.findByText(/1 tip \(\$100\.00\) refunded to the tipper and not counted/)).toBeInTheDocument()
  })

  it('joins a show to the one before only after confirming', async () => {
    api.list.mockResolvedValue(list([show({ id: 'a', isLive: false }), show({ id: 'b', isLive: false })]))
    api.mergeIntoPrevious.mockResolvedValue({ data: show() })
    render(<ShowsList />)

    fireEvent.click((await screen.findAllByRole('button', { name: 'Join to the show before' }))[0])

    await waitFor(() => expect(api.mergeIntoPrevious).toHaveBeenCalledWith('a'))
    expect(feedback.confirm).toHaveBeenCalled()
  })

  it('does not offer to join the very first show', async () => {
    api.list.mockResolvedValue(list([show({ id: 'a', isLive: false }), show({ id: 'b', isLive: false })]))
    render(<ShowsList />)
    expect(await screen.findAllByRole('button', { name: 'Join to the show before' })).toHaveLength(1)
  })

  it('renames a show; an empty name goes back to the default', async () => {
    api.list.mockResolvedValue(list([show({ id: 'a', isLive: false })]))
    api.update.mockResolvedValue({ data: show() })
    render(<ShowsList />)

    fireEvent.click(await screen.findByRole('button', { name: 'Name and place' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: "Friday at Joe's" } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.update).toHaveBeenCalledWith('a', { name: "Friday at Joe's", venueName: null }))
  })

  it('shows a calm empty state before the first show', async () => {
    api.list.mockResolvedValue(list([]))
    render(<ShowsList />)
    expect(await screen.findByText('No shows yet')).toBeInTheDocument()
  })
})
