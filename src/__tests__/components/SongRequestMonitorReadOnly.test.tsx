import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SongRequestMonitor from '@/components/SongRequestMonitor'
import AdminWatchLivePage from '@/pages/AdminWatchLivePage'

vi.mock('@/utils/config', () => ({ API_BASE_URL: 'http://localhost:3000' }))
vi.mock('@/components/venue/SessionBanner', () => ({ SessionBanner: () => <div>session banner</div> }))
vi.mock('@/utils/tipChime', () => ({ playTipChime: vi.fn(() => true), unlockTipChime: vi.fn(async () => true), isTipChimeReady: vi.fn(() => true) }))
vi.mock('@/theme/ThemeContext', () => ({
  usePortalTheme: () => ({ dark: false, className: '' }),
  useTheme: () => ({ setPreference: vi.fn() })
}))

const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const request = (id: string, title: string, status: string, tip = 20) => ({
  songId: `song-${id}`, songTitle: title, artist: 'Artist', status, totalTipAmount: tip, requestCount: 1,
  firstRequestTime: minutesAgo(5), lastRequestTime: minutesAgo(5), requestIds: [id],
  items: [{ requestId: id, tipId: `tip-${id}`, amount: tip, createdAt: minutesAgo(5), refundRequest: null }]
})

const queue = {
  songRequests: [request('a', 'Waiting song', 'pending'), request('b', 'Playing song', 'performing'), request('c', 'Done song', 'completed')],
  tipsWithoutSong: [{ id: 't1', amount: 10, createdAt: minutesAgo(2), status: 'processed', refundRequest: null }]
}

let fetchCalls: { url: string; method: string }[] = []

class FakeIntersectionObserver { observe() {} unobserve() {} disconnect() {} }

beforeEach(() => {
  ;(globalThis as any).IntersectionObserver = FakeIntersectionObserver
  localStorage.clear()
  fetchCalls = []
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), method: (init?.method ?? 'GET').toUpperCase() })
    return Promise.resolve({ ok: true, json: async () => queue, text: async () => '' })
  }) as any
})

const noActionButtons = () => {
  for (const name of [/Play this/, /Already played/, /^Skip/, /Done playing/, /Seen/, /Request refund/, /Request a refund/]) {
    expect(screen.queryByRole('button', { name })).toBeNull()
  }
}

describe('SongRequestMonitor, read only (an admin watching)', () => {
  it('shows the same songs and tips a performer sees, with no button that changes anything', async () => {
    render(<SongRequestMonitor profileId="p1" isVisible readOnly watchingLabel="Watching Dave" onClose={() => undefined} />)

    expect(await screen.findByText('Waiting song')).toBeInTheDocument()
    expect(screen.getAllByText('Playing song').length).toBeGreaterThan(0) // the playing song has a narrow and a wide layout
    expect(screen.getByText('$10.00')).toBeInTheDocument() // the tip with no song
    noActionButtons()
  })

  it('says whose screen it is and that it is view only', async () => {
    render(<SongRequestMonitor profileId="p1" isVisible readOnly watchingLabel="Watching Dave" onClose={() => undefined} />)
    await screen.findByText('Waiting song')
    expect(screen.getByText(/Watching Dave · view only/)).toBeInTheDocument()
  })

  it('never writes anything: only reads the queue, and leaves out the watcher\'s own session banner and show list', async () => {
    render(<SongRequestMonitor profileId="p1" isVisible readOnly onClose={() => undefined} />)
    await screen.findByText('Waiting song')
    await new Promise(r => setTimeout(r, 150))

    expect(fetchCalls.every(c => c.method === 'GET')).toBe(true)
    expect(fetchCalls.some(c => c.url.includes('/api/SongCatalog/monitor/p1'))).toBe(true)
    expect(fetchCalls.some(c => /\/shows/i.test(c.url))).toBe(false)
    expect(screen.queryByText('session banner')).toBeNull()
  })

  it('a performer\'s own screen is unchanged: the buttons are there', async () => {
    render(<SongRequestMonitor profileId="p1" isVisible onClose={() => undefined} />)
    expect(await screen.findByText('Waiting song')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Play this/ })).toBeInTheDocument()
    expect(screen.queryByText(/view only/)).toBeNull()
  })

  it('shows a refund that was already asked for as a status, but offers no new request', async () => {
    queue.songRequests[0].items![0].refundRequest = 'pending' as any
    render(<SongRequestMonitor profileId="p1" isVisible readOnly onClose={() => undefined} />)
    await screen.findByText('Waiting song')
    expect(screen.getByText('Refund requested')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Request a refund/ })).toBeNull()
    queue.songRequests[0].items![0].refundRequest = null as any
  })
})

describe('the admin watch page', () => {
  const open = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/watch-live/:profileId" element={<AdminWatchLivePage />} />
        </Routes>
      </MemoryRouter>
    )

  it('watches the performer in the link, labelled with their name, view only', async () => {
    open('/admin/watch-live/perf-9?n=Dave%20Lovett')

    expect(await screen.findByText('Waiting song')).toBeInTheDocument()
    expect(screen.getByText(/Watching Dave Lovett · view only/)).toBeInTheDocument()
    await waitFor(() => expect(fetchCalls.some(c => c.url.includes('/api/SongCatalog/monitor/perf-9'))).toBe(true))
    noActionButtons()
  })

  it('shows a name that tries to be markup as plain text', async () => {
    open('/admin/watch-live/perf-9?n=' + encodeURIComponent('<img src=x onerror=alert(1)>'))
    await screen.findByText('Waiting song')
    expect(document.querySelector('img[src="x"]')).toBeNull()
    expect(screen.getByText(/Watching <img src=x onerror=alert\(1\)>/)).toBeInTheDocument()
  })
})
