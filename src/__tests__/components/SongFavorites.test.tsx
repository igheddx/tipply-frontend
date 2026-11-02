import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SongManagement from '@/components/SongManagement'

vi.mock('@/utils/config', () => ({ API_BASE_URL: 'http://api.test' }))

const song = (id: string, title: string, isFavorite = false) => ({
  id, songTitle: title, artist: 'Band', album: '', genre: '', isActive: true, isFavorite, createdAt: '2026-11-01T00:00:00Z'
})

const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k] ?? null })

let calls: Array<{ url: string; init?: RequestInit }> = []

const mockApi = (catalog = [song('a', 'Alpha', true), song('b', 'Beta')], opts: { favoriteOk?: boolean } = {}) => {
  calls = []
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.includes('/my-songs/')) {
      const onlyFav = url.includes('favoritesOnly=true')
      const list = onlyFav ? catalog.filter(c => c.isFavorite) : catalog
      return Promise.resolve({ ok: true, json: async () => list, headers: headers({ 'X-Total-Count': String(list.length), 'X-Favorite-Count': String(catalog.filter(c => c.isFavorite).length) }) })
    }
    if (url.includes('/favorite')) return Promise.resolve({ ok: opts.favoriteOk ?? true, json: async () => ({}) })
    if (url.includes('/bulk-favorite')) return Promise.resolve({ ok: true, json: async () => ({ successCount: 1 }) })
    if (url.includes('/musicbrainz/search')) return Promise.resolve({ ok: true, json: async () => [{ id: 'mb1', title: 'Hello', artist: 'Adele', album: '25', genre: 'Pop' }] })
    if (url.endsWith('/api/songcatalog/add')) return Promise.resolve({ ok: true, json: async () => ({ id: 'cat-1' }) })
    return Promise.resolve({ ok: true, json: async () => ({}), headers: headers({}) })
  }) as any
}

const bodyOf = (call?: { init?: RequestInit }) => JSON.parse(String(call?.init?.body ?? '{}'))

describe('artist favorites in song management', () => {
  beforeEach(() => {
    ;(localStorage.getItem as any).mockReset?.()
  })

  it('shows a star on each catalog song, and a tap marks it without any extra step', async () => {
    mockApi()
    render(<SongManagement profileId="p1" />)
    fireEvent.click(screen.getByRole('tab', { name: /My catalog/ }))

    const mark = await screen.findByRole('button', { name: 'Mark Beta as a favorite' })
    expect(screen.getByRole('button', { name: 'Remove Alpha from your favorites' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(mark)
    expect(screen.getByRole('button', { name: 'Remove Beta from your favorites' })).toBeInTheDocument()
    await waitFor(() => expect(calls.some(c => c.url.includes('/b/favorite') && c.init?.method === 'PUT')).toBe(true))
    expect(bodyOf(calls.find(c => c.url.includes('/b/favorite')))).toEqual({ isFavorite: true })
  })

  it('puts the star back and says so when the save fails', async () => {
    mockApi(undefined, { favoriteOk: false })
    render(<SongManagement profileId="p1" />)
    fireEvent.click(screen.getByRole('tab', { name: /My catalog/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Beta as a favorite' }))

    expect(await screen.findByText('Could not save that. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark Beta as a favorite' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('filters the catalog to favorites, with the count', async () => {
    mockApi()
    render(<SongManagement profileId="p1" />)
    fireEvent.click(screen.getByRole('tab', { name: /My catalog/ }))
    await screen.findByText('Beta')

    fireEvent.click(screen.getByRole('button', { name: /^Favorites \(1\)/ }))
    await waitFor(() => expect(screen.queryByText('Beta')).toBeNull())
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(calls.some(c => c.url.includes('favoritesOnly=true'))).toBe(true)
  })

  it('marks several selected songs as favorites at once', async () => {
    mockApi()
    render(<SongManagement profileId="p1" />)
    fireEvent.click(screen.getByRole('tab', { name: /My catalog/ }))
    fireEvent.click(await screen.findByLabelText('Select Beta'))
    fireEvent.click(screen.getByRole('button', { name: /Mark favorite/ }))

    await waitFor(() => expect(calls.some(c => c.url.includes('/bulk-favorite'))).toBe(true))
    expect(bodyOf(calls.find(c => c.url.includes('/bulk-favorite')))).toEqual({ profileId: 'p1', songIds: ['b'], isFavorite: true })
  })

  it('adds a searched song as a favorite when the star is tapped first', async () => {
    mockApi()
    render(<SongManagement profileId="p1" />)
    fireEvent.change(screen.getByLabelText('Song title'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Mark Hello as a favorite' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add as favorite' }))

    await waitFor(() => expect(calls.some(c => c.url.endsWith('/api/songcatalog/add'))).toBe(true))
    expect(bodyOf(calls.find(c => c.url.endsWith('/api/songcatalog/add'))).isFavorite).toBe(true)
    expect(await screen.findByText('Added')).toBeInTheDocument()
  })

  it('shows the new favorite column in the upload instructions, with a template to download', () => {
    mockApi()
    render(<SongManagement profileId="p1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Upload a list' }))

    expect(screen.getAllByText(/title,artist,album,genre,favorite/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Download a template' })).toBeInTheDocument()
  })
})
