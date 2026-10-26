import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SongRequestMonitor from '@/components/SongRequestMonitor'

vi.mock('@/utils/config', () => ({ API_BASE_URL: 'http://localhost:3000' }))
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

describe('SongRequestMonitor', () => {
  beforeEach(() => {
    localStorage.clear()
    document.title = 'Tipwave'
  })

  it('lists requests with the highest tip first and shows the waiting count', async () => {
    mockQueue([request('a', 'Low tip song', 2, 5), request('b', 'High tip song', 20, 1)])
    renderMonitor()

    await screen.findByText('High tip song')
    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(titles).toEqual(['High tip song', 'Low tip song'])
    expect(screen.getByLabelText('2 waiting')).toBeInTheDocument()
    expect(document.title).toBe('(2) Live requests')
  })

  it('has no sound control', async () => {
    mockQueue([request('a', 'Song', 5, 1)])
    const { container } = renderMonitor()
    await screen.findByText('Song')
    expect(screen.queryByLabelText(/sound/i)).toBeNull()
    expect(container.querySelector('audio')).toBeNull()
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
})
