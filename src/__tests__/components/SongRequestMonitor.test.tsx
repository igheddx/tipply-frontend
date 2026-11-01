import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SongRequestMonitor from '@/components/SongRequestMonitor'

vi.mock('@/utils/config', () => ({ API_BASE_URL: 'http://localhost:3000' }))
const chime = vi.hoisted(() => ({ playTipChime: vi.fn(() => true), unlockTipChime: vi.fn(async () => true), isTipChimeReady: vi.fn(() => true) }))
vi.mock('@/utils/tipChime', () => chime)
vi.mock('@/theme/ThemeContext', () => ({
  usePortalTheme: () => ({ dark: false, className: '' }),
  useTheme: () => ({ setPreference: vi.fn() })
}))

const request = (id: string, title: string, tip: number, minutesAgo: number) => ({
  songId: `song-${id}`,
  songTitle: title,
  artist: 'Artist',
  status: 'pending',
  totalTipAmount: tip,
  requestCount: 1,
  firstRequestTime: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  lastRequestTime: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  requestIds: [id]
})

const mockQueue = (list: unknown[]) => {
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return Promise.resolve({ ok: true, text: async () => '' })
    return Promise.resolve({ ok: true, json: async () => ({ songRequests: list }) })
  }) as any
}

const renderMonitor = () => render(<SongRequestMonitor profileId="p1" isVisible onClose={() => undefined} />)

// jsdom has no IntersectionObserver; the monitor uses one to clear the NEW badge once a request has been on screen
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('SongRequestMonitor', () => {
  beforeEach(() => {
    ;(globalThis as any).IntersectionObserver = FakeIntersectionObserver
    localStorage.clear()
    ;(localStorage.getItem as any).mockReset?.()
    document.title = 'Tipwave'
  })

  it('lists requests with the highest tip first and shows the waiting count', async () => {
    mockQueue([request('a', 'Low tip song', 2, 5), request('b', 'High tip song', 20, 1)])
    renderMonitor()

    await screen.findByText('High tip song')
    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(titles).toEqual(['High tip song', 'Low tip song'])
    expect(screen.getByLabelText('2 waiting')).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('(2) Live requests'))
  })

  it('has a sound option for new tips in the menu, on by default, and remembers when it is turned off', async () => {
    mockQueue([request('a', 'Song', 5, 1)])
    renderMonitor()
    await screen.findByText('Song')
    fireEvent.click(screen.getByLabelText('More options'))
    const toggle = screen.getByRole('switch', { name: 'Sound for new tips' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(localStorage.setItem).toHaveBeenCalledWith('monitor_tip_sound', '0')
  })

  it('shows a notice and plays the chime when a tipped request arrives, not for the first load', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      chime.playTipChime.mockClear()
      let calls = 0
      global.fetch = vi.fn().mockImplementation(() => {
        calls++
        const list = calls === 1 ? [request('a', 'First Song', 5, 3)] : [request('a', 'First Song', 5, 3), request('b', 'Wagon Wheel', 20, 0)]
        return Promise.resolve({ ok: true, json: async () => ({ songRequests: list }) })
      }) as any
      renderMonitor()
      await screen.findByText('First Song')
      expect(chime.playTipChime).not.toHaveBeenCalled()
      expect(screen.queryByText(/New tip/)).toBeNull()

      await vi.advanceTimersByTimeAsync(5100)
      expect(await screen.findByText('New tip $20.00: Wagon Wheel')).toBeInTheDocument()
      expect(chime.playTipChime).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(7000)
      await waitFor(() => expect(screen.queryByText('New tip $20.00: Wagon Wheel')).toBeNull())
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the notice but stays quiet when the sound is off', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      ;(localStorage.getItem as any).mockImplementation((k: string) => (k === 'monitor_tip_sound' ? '0' : null))
      chime.playTipChime.mockClear()
      let calls = 0
      global.fetch = vi.fn().mockImplementation(() => {
        calls++
        const list = calls === 1 ? [] : [request('b', 'Song B', 10, 0)]
        return Promise.resolve({ ok: true, json: async () => ({ songRequests: list }) })
      }) as any
      renderMonitor()
      await waitFor(() => expect(calls).toBeGreaterThan(0))
      await vi.advanceTimersByTimeAsync(5100)
      expect(await screen.findByText('New tip $10.00: Song B')).toBeInTheDocument()
      expect(chime.playTipChime).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers Undo after a skip and sends the right statuses', async () => {
    mockQueue([request('a', 'Song', 5, 1)])
    renderMonitor()
    fireEvent.click(await screen.findByLabelText('Skip Song'))

    const undo = await screen.findByRole('button', { name: 'Undo' })
    fireEvent.click(undo)

    await waitFor(() => {
      const bodies = (global.fetch as any).mock.calls
        .filter((c: any[]) => c[1]?.method === 'PUT')
        .map((c: any[]) => JSON.parse(c[1].body).status)
      expect(bodies).toEqual(['skipped', 'pending'])
    })
  })

  it('keeps text size, theme and device pause in the menu', async () => {
    mockQueue([])
    renderMonitor()
    expect(screen.queryByLabelText('Larger text')).toBeNull()
    fireEvent.click(await screen.findByLabelText('More options'))
    expect(screen.getByLabelText('Larger text')).toBeInTheDocument()
  })

  it('flags a request for a song played recently, and lets the performer mark one as already played', async () => {
    mockQueue([
      { ...request('a', 'Superstition', 5, 1), playedMinutesAgo: 25 },
      request('b', 'Fresh Song', 3, 2)
    ])
    renderMonitor()

    expect(await screen.findByText('Played 25 min ago')).toBeInTheDocument()
    expect(screen.getAllByText(/^Played /)).toHaveLength(1)

    fireEvent.click(screen.getByLabelText('Mark Superstition as already played'))
    expect(await screen.findByText('Marked “Superstition” as played')).toBeInTheDocument()
    await waitFor(() => {
      const bodies = (global.fetch as any).mock.calls
        .filter((c: any[]) => c[1]?.method === 'PUT')
        .map((c: any[]) => JSON.parse(c[1].body).status)
      expect(bodies).toEqual(['completed'])
    })
  })
})
