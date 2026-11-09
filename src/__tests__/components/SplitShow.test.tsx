import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SplitShowModal } from '@/components/shows/SplitShowModal'
import { ShowsList } from '@/components/shows/ShowsList'

const api = vi.hoisted(() => ({ tips: vi.fn(), split: vi.fn(), list: vi.fn(), update: vi.fn(), end: vi.fn(), mergeIntoPrevious: vi.fn(), venues: vi.fn() }))
vi.mock('@/services/showApi', () => ({ showApi: api }))
const feedback = vi.hoisted(() => ({ toast: vi.fn(), confirm: vi.fn(async () => true) }))
vi.mock('@/components/ui/Feedback', () => ({ useFeedback: () => feedback, FeedbackProvider: ({ children }: any) => children }))

const show = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: null, venueName: null, startedAt: '2026-11-07T21:00:00', endedAt: '2026-11-08T01:20:00', isLive: false,
  tipCount: 4, gross: 75, waitingGross: 0, fees: 4, youKeep: 71, refundedCount: 0, refundedGross: 0, ...over
})
const tip = (id: string, at: string, amount: number, status = 'processed') => ({ id, createdAt: at, amount, status })
const TIPS = [
  tip('t1', '2026-11-07T21:05:00', 10),
  tip('t2', '2026-11-07T23:30:00', 20),
  tip('t3', '2026-11-08T00:10:00', 40),
  tip('t4', '2026-11-08T01:20:00', 5)
]

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  feedback.toast.mockClear()
  api.tips.mockResolvedValue({ data: { tips: TIPS } })
  api.venues.mockResolvedValue({ data: { venues: [] } })
})

describe('SplitShowModal', () => {
  it('lists the tips, marks the day change, and cannot split at the very first tip', async () => {
    render(<SplitShowModal show={show() as any} allShows={[]} onClose={() => {}} onSplit={() => {}} />)

    const list = await screen.findByRole('list', { name: 'Tips in this show' })
    expect(within(list).getAllByRole('button')).toHaveLength(4)
    expect(within(list).getAllByRole('button')[0]).toBeDisabled()
    expect(within(list).getAllByText(/^(Sat|Sun)/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Split here' })).toBeDisabled()
  })

  it('previews what each show would hold before anything changes, with the same total', async () => {
    render(<SplitShowModal show={show() as any} allShows={[]} onClose={() => {}} onSplit={() => {}} />)
    const list = await screen.findByRole('list', { name: 'Tips in this show' })

    fireEvent.click(within(list).getAllByRole('button')[2]) // the $40 tip

    const preview = await screen.findByTestId('split-preview')
    expect(preview).toHaveTextContent('$30.00') // first show: 10 + 20
    expect(preview).toHaveTextContent('2 tips')
    expect(preview).toHaveTextContent('$45.00') // new show: 40 + 5
    expect(screen.getByText('New show starts here')).toBeInTheDocument()
    expect(api.split).not.toHaveBeenCalled()
  })

  it('does not count a refunded tip in either preview total', async () => {
    api.tips.mockResolvedValue({ data: { tips: [tip('t1', '2026-11-07T21:05:00', 10), tip('t2', '2026-11-07T22:00:00', 100, 'refunded'), tip('t3', '2026-11-07T23:00:00', 40)] } })
    render(<SplitShowModal show={show() as any} allShows={[]} onClose={() => {}} onSplit={() => {}} />)
    const list = await screen.findByRole('list', { name: 'Tips in this show' })

    fireEvent.click(within(list).getAllByRole('button')[2])

    const preview = await screen.findByTestId('split-preview')
    expect(preview).toHaveTextContent('$10.00')
    expect(preview).toHaveTextContent('$40.00')
    expect(preview).not.toHaveTextContent('$100.00')
  })

  it('splits at the chosen tip and tells the list to reload', async () => {
    api.split.mockResolvedValue({ data: { first: show(), second: show() } })
    const onSplit = vi.fn()
    render(<SplitShowModal show={show() as any} allShows={[]} onClose={() => {}} onSplit={onSplit} />)
    const list = await screen.findByRole('list', { name: 'Tips in this show' })

    fireEvent.click(within(list).getAllByRole('button')[2])
    fireEvent.click(screen.getByRole('button', { name: 'Split here' }))

    await waitFor(() => expect(api.split).toHaveBeenCalledWith('s1', 't3'))
    await waitFor(() => expect(onSplit).toHaveBeenCalled())
  })

  it('shows the server’s reason and keeps the dialog open when the split is refused', async () => {
    api.split.mockResolvedValue({ error: 'Choose a later tip, so the first show keeps at least one tip.' })
    const onSplit = vi.fn()
    render(<SplitShowModal show={show() as any} allShows={[]} onClose={() => {}} onSplit={onSplit} />)
    const list = await screen.findByRole('list', { name: 'Tips in this show' })

    fireEvent.click(within(list).getAllByRole('button')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Split here' }))

    await waitFor(() => expect(feedback.toast).toHaveBeenCalledWith('Choose a later tip, so the first show keeps at least one tip.', 'error'))
    expect(onSplit).not.toHaveBeenCalled()
  })

  it('says so when the tips cannot be loaded', async () => {
    api.tips.mockResolvedValue({ error: 'nope' })
    render(<SplitShowModal show={show() as any} allShows={[]} onClose={() => {}} onSplit={() => {}} />)
    expect(await screen.findByText(/Could not load the tips/)).toBeInTheDocument()
  })
})

describe('ShowsList split button', () => {
  const list = (shows: unknown[]) => ({ data: { shows, total: shows.length, page: 1, pageSize: 20 } })

  it('offers Split only on a show with at least two tips', async () => {
    api.list.mockResolvedValue(list([show({ id: 'a', tipCount: 3 }), show({ id: 'b', tipCount: 1, startedAt: '2026-11-06T21:00:00', endedAt: '2026-11-06T21:30:00' })]))
    render(<ShowsList />)
    await screen.findByText('2 shows')
    const menus = screen.getAllByRole('button', { name: /More actions for/ })
    fireEvent.click(menus[0])
    expect(screen.getAllByRole('menuitem', { name: 'Split this show' })).toHaveLength(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(menus[1]) // one tip only: nothing to split
    expect(screen.queryByRole('menuitem', { name: 'Split this show' })).toBeNull()
  })

  it('opens the split dialog for that show, and reloads the list after a split', async () => {
    api.list.mockResolvedValue(list([show({ id: 'a' })]))
    api.split.mockResolvedValue({ data: { first: show(), second: show() } })
    render(<ShowsList />)

    fireEvent.click(await screen.findByRole('button', { name: /More actions for/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Split this show' }))
    const dialogList = await screen.findByRole('list', { name: 'Tips in this show' })
    fireEvent.click(within(dialogList).getAllByRole('button')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Split here' }))

    await waitFor(() => expect(api.split).toHaveBeenCalledWith('a', 't2'))
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
  })
})
