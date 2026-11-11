import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SongRequestMonitor from '@/components/SongRequestMonitor'

vi.mock('@/utils/config', () => ({ API_BASE_URL: 'http://localhost:3000' }))
// The venue session notice makes its own requests; it has its own tests
vi.mock('@/components/venue/SessionBanner', () => ({ SessionBanner: () => null }))
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
    await waitFor(() => expect(document.title).toBe('(2) Live'))
  })

  it('shows a test request marked TEST at $0, and a real request as normal', async () => {
    mockQueue([{ ...request('t', 'Test song', 0, 1), isTest: true }, request('r', 'Real song', 20, 2)])
    renderMonitor()

    await screen.findByText('Test song')
    expect(screen.getByText(/TEST · \$0\.00/)).toBeInTheDocument()
    expect(screen.getByText('$20.00')).toBeInTheDocument()
    expect(screen.getAllByText(/TEST/)).toHaveLength(1)
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

  it('asks for one tap to allow sound, plays a sample, and then stops asking', async () => {
    chime.isTipChimeReady.mockReturnValue(false)
    chime.unlockTipChime.mockClear()
    chime.playTipChime.mockClear()
    mockQueue([request('a', 'Song', 5, 1)])
    renderMonitor()
    const button = await screen.findByRole('button', { name: /tap to turn on tip sounds/i })
    fireEvent.click(button)
    await waitFor(() => expect(chime.playTipChime).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: /tap to turn on tip sounds/i })).toBeNull())
    chime.isTipChimeReady.mockReturnValue(true)
  })

  it('shows a notice and plays the chime when a tipped request arrives, not for the first load', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      chime.playTipChime.mockClear()
      let calls = 0
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (!String(url).includes('/SongCatalog/monitor')) return Promise.resolve({ ok: true, json: async () => ({ shows: [] }) })
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
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (!String(url).includes('/SongCatalog/monitor')) return Promise.resolve({ ok: true, json: async () => ({ shows: [] }) })
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

  describe('tips without a song', () => {
    const plain = (id: string, amount: number, minutesAgo = 1) => ({ id, amount, createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString() })
    const mockWithPlain = (tips: unknown[]) => {
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({ ok: true, json: async () => ({ songRequests: [request('a', 'First Song', 5, 3)], tipsWithoutSong: tips }) })
      ) as any
    }

    it('lists them in their own section, and lets the performer mark one as seen and bring it back', async () => {
      mockWithPlain([plain('t1', 100), plain('t2', 20)])
      renderMonitor()

      const section = await screen.findByRole('region', { name: 'Tips without a song' })
      expect(section).toHaveTextContent('$100.00')
      expect(section).toHaveTextContent('$20.00')
      // The song queue is untouched
      expect(screen.getByText('First Song')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Mark the $100.00 tip as seen' }))
      expect(screen.queryByRole('button', { name: 'Mark the $100.00 tip as seen' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /Show seen \(1\)/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(screen.getByRole('button', { name: 'Mark the $100.00 tip as seen' })).toBeInTheDocument()
    })

    it('has no section when there are none', async () => {
      mockWithPlain([])
      renderMonitor()
      await screen.findByText('First Song')
      expect(screen.queryByRole('region', { name: 'Tips without a song' })).toBeNull()
    })

    it('announces a new one with the notice and chime, but not on the first load', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        chime.playTipChime.mockClear()
        let calls = 0
        global.fetch = vi.fn().mockImplementation((url: string) => {
          if (!String(url).includes('/SongCatalog/monitor')) return Promise.resolve({ ok: true, json: async () => ({ shows: [] }) })
          calls++
          const tips = calls === 1 ? [plain('t1', 20)] : [plain('t1', 20), plain('t2', 50, 0)]
          return Promise.resolve({ ok: true, json: async () => ({ songRequests: [], tipsWithoutSong: tips }) })
        }) as any
        renderMonitor()
        await screen.findByRole('region', { name: 'Tips without a song' })
        expect(chime.playTipChime).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(5100)
        expect(await screen.findByText('New tip $50.00')).toBeInTheDocument()
        expect(chime.playTipChime).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })
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

  describe('every tip, the time it came in, and refund requests', () => {
    const tip = (id: string, amount: number, minutesAgo: number, over: Record<string, unknown> = {}) => ({
      id, amount, createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(), status: 'processed', ...over
    })
    const showsList = [
      { id: 's2', name: null, venueName: null, startedAt: new Date(Date.now() - 3 * 3600000).toISOString(), endedAt: new Date().toISOString(), isLive: true, tipCount: 2, gross: 25, waitingGross: 0, fees: 0, youKeep: 0, refundedCount: 0, refundedGross: 0 },
      { id: 's1', name: null, venueName: null, startedAt: new Date(Date.now() - 30 * 3600000).toISOString(), endedAt: new Date(Date.now() - 27 * 3600000).toISOString(), isLive: false, tipCount: 1, gross: 8, waitingGross: 0, fees: 0, youKeep: 0, refundedCount: 0, refundedGross: 0 }
    ]
    const mockMonitor = (body: Record<string, unknown>, seen?: string[]) => {
      global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        const u = String(url)
        if (init?.method === 'PUT') return Promise.resolve({ ok: true, text: async () => '' })
        if (u.includes('/SongCatalog/monitor')) { seen?.push(u); return Promise.resolve({ ok: true, json: async () => body }) }
        if (u.includes('/api/shows')) return Promise.resolve({ ok: true, json: async () => ({ shows: showsList }) })
        if (u.includes('/api/refund-requests')) return Promise.resolve({ ok: true, json: async () => ({ id: 'rr1', status: 'pending' }) })
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }) as any
    }

    it('shows the clock time of each tip without a song, next to how long ago it was', async () => {
      mockMonitor({ songRequests: [], tipsWithoutSong: [tip('a', 50, 12)] })
      renderMonitor()

      const row = (await screen.findByLabelText('Mark the $50.00 tip as seen')).closest('li')!
      expect(row.textContent).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i)
      expect(row.textContent).toMatch(/12 min ago/)
    })

    it('shows the performer nothing about who tipped, only the amount and the time', async () => {
      mockMonitor({ songRequests: [], tipsWithoutSong: [tip('a', 50, 12), tip('b', 50, 4)] })
      renderMonitor()

      const row = (await screen.findAllByLabelText('Mark the $50.00 tip as seen'))[0].closest('li')!
      expect(row.textContent).not.toMatch(/tipper/i)
    })

    it('offers Request refund on a charged tip, but not on one still waiting to be charged', async () => {
      mockMonitor({ songRequests: [], tipsWithoutSong: [tip('a', 50, 12), tip('b', 5, 3, { status: 'pending' })] })
      renderMonitor()

      await screen.findByLabelText('Mark the $50.00 tip as seen')
      expect(screen.getAllByRole('button', { name: /Request a refund/ })).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Request a refund for the $50.00 tip' })).toBeInTheDocument()
    })

    it('shows the request status instead of the button once a refund was asked for', async () => {
      mockMonitor({ songRequests: [], tipsWithoutSong: [tip('a', 50, 12, { refundRequest: 'pending' }), tip('b', 20, 8, { refundRequest: 'declined' })] })
      renderMonitor()

      expect(await screen.findByText('Refund requested')).toBeInTheDocument()
      expect(screen.getByText('Not refunded')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Request a refund/ })).toBeNull()
    })

    it('sends a refund request for a tip from the queue', async () => {
      mockMonitor({ songRequests: [], tipsWithoutSong: [tip('a', 50, 12)] })
      renderMonitor()

      fireEvent.click(await screen.findByRole('button', { name: 'Request a refund for the $50.00 tip' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Send request' }))

      await waitFor(() => {
        const call = (global.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/refund-requests'))
        expect(call).toBeTruthy()
        expect(JSON.parse(call[1].body)).toEqual(expect.objectContaining({ tipId: 'a', reason: 'mistake' }))
      })
    })

    it('can ask for a refund on a song request, by the request itself when its tip is not recorded', async () => {
      mockMonitor({
        songRequests: [{ ...request('a', 'Redemption Song', 20, 10), items: [{ requestId: 'req-1', amount: 20, createdAt: new Date(Date.now() - 600000).toISOString() }] }],
        tipsWithoutSong: []
      })
      renderMonitor()

      fireEvent.click(await screen.findByRole('button', { name: 'Request a refund for Redemption Song' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Send request' }))

      await waitFor(() => {
        const call = (global.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/refund-requests'))
        expect(JSON.parse(call[1].body)).toEqual(expect.objectContaining({ songRequestId: 'req-1' }))
      })
    })

    it('has a Show picker, and asks the server for the show the performer chose', async () => {
      const urls: string[] = []
      mockMonitor({ songRequests: [], tipsWithoutSong: [] }, urls)
      renderMonitor()

      const picker = await screen.findByLabelText('Show')
      expect(urls[0]).not.toContain('showId=')
      fireEvent.change(picker, { target: { value: 's1' } })

      await waitFor(() => expect(urls.some(u => u.includes('showId=s1'))).toBe(true))
    })

    it('goes back to following the current show when the first choice is picked again', async () => {
      const urls: string[] = []
      mockMonitor({ songRequests: [], tipsWithoutSong: [] }, urls)
      renderMonitor()
      const picker = await screen.findByLabelText('Show')
      fireEvent.change(picker, { target: { value: 's1' } })
      await waitFor(() => expect(urls.some(u => u.includes('showId=s1'))).toBe(true))
      const before = urls.length

      fireEvent.change(picker, { target: { value: '' } })

      await waitFor(() => expect(urls.length).toBeGreaterThan(before))
      expect(urls[urls.length - 1]).not.toContain('showId=')
    })
  })
})
