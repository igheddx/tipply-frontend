import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SongManagement from '@/components/SongManagement'

vi.mock('@/utils/config', () => ({ API_BASE_URL: 'http://localhost:3000/api' }))

const respond = (count: number) =>
  vi.fn(async () => ({
    ok: true,
    headers: { get: (k: string) => (k.toLowerCase() === 'x-total-count' ? String(count) : null) },
    json: async () => (count > 0 ? Array.from({ length: Math.min(count, 1) }, (_, i) => ({ id: `s${i}`, title: 'Piano Man', artist: 'Billy Joel', isFavorite: false })) : [])
  })) as unknown as typeof fetch

const tab = (name: RegExp) => screen.findByRole('tab', { name })

describe('SongManagement opening view', () => {
  beforeEach(() => {
    localStorage.getItem = vi.fn((k: string) => (k === 'token' ? 't' : null))
  })

  it('opens on My catalog when the performer already has songs', async () => {
    global.fetch = respond(8)
    render(<SongManagement profileId="p1" />)
    await waitFor(async () => expect(await tab(/My catalog/)).toHaveAttribute('aria-selected', 'true'))
  })

  it('stays on Find songs when the catalog is empty', async () => {
    global.fetch = respond(0)
    render(<SongManagement profileId="p1" />)
    await tab(/Find songs/)
    await new Promise(r => setTimeout(r, 50))
    expect(await tab(/Find songs/)).toHaveAttribute('aria-selected', 'true')
  })

  it('never overrides a tab the person already chose', async () => {
    global.fetch = respond(8)
    render(<SongManagement profileId="p1" />)
    fireEvent.click(await tab(/Upload a list/))
    await new Promise(r => setTimeout(r, 80))
    expect(await tab(/Upload a list/)).toHaveAttribute('aria-selected', 'true')
  })

  it('does not pull someone away from the search box once they have started typing', async () => {
    let release: (v: unknown) => void = () => {}
    const slow = new Promise(r => (release = r))
    global.fetch = vi.fn(async () => {
      await slow // the song count arrives late
      return { ok: true, headers: { get: (k: string) => (k.toLowerCase() === 'x-total-count' ? '8' : null) }, json: async () => [] }
    }) as unknown as typeof fetch
    render(<SongManagement profileId="p1" />)

    fireEvent.change(screen.getByPlaceholderText(/Your Love Is King/), { target: { value: 'Hello' } })
    release(null)
    await new Promise(r => setTimeout(r, 80))

    expect(await tab(/Find songs/)).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByPlaceholderText(/Your Love Is King/)).toHaveValue('Hello')
  })
})
