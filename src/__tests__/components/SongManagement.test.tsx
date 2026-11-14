import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import SongManagement from '@/components/SongManagement'

vi.mock('@/utils/config', () => ({
  API_BASE_URL: 'http://localhost:3000'
}))

/**
 * The performer's catalog screen, tested against a small fake server that pages the way the real one does (page, limit, search,
 * favoritesOnly; X-Total-Count and X-Favorite-Count headers). The point of the volume cases is the LAST song of a big catalog: an earlier
 * version of this file used two songs, which could never show a list that stops short.
 */
const PROFILE = 'profile-1'

type Song = { id: string; songTitle: string; artist: string; album: string; genre: string; isActive: boolean; isFavorite: boolean; createdAt: string }

const makeSongs = (n: number, favoriteEvery = 0): Song[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `song-${i}`,
    songTitle: `Song ${String(i + 1).padStart(4, '0')}`,
    artist: `Artist ${i % 7}`,
    album: '',
    genre: '',
    isActive: true,
    isFavorite: favoriteEvery > 0 && i % favoriteEvery === 0,
    createdAt: '2026-11-01T00:00:00Z'
  }))

let catalog: Song[] = []
let sendHeaders = true
let calls: { url: string; method: string }[] = []

const reply = (body: unknown, headers: Record<string, string> = {}) => ({ ok: true, status: 200, json: async () => body, headers: new Headers(headers) }) as any

const installServer = () => {
  global.fetch = vi.fn(async (input: any, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    calls.push({ url, method })

    if (method === 'DELETE') {
      const id = url.split('/songcatalog/')[1].split('?')[0]
      catalog = catalog.filter(s => s.id !== id)
      return reply({})
    }
    if (method === 'PUT' && /\/favorite/.test(url)) return reply({})

    if (url.includes('/api/songcatalog/my-songs/')) {
      const q = new URL(url).searchParams
      const page = parseInt(q.get('page') ?? '1', 10)
      const limit = parseInt(q.get('limit') ?? '20', 10)
      const search = (q.get('search') ?? '').toLowerCase()
      let rows = catalog
      const favorites = catalog.filter(s => s.isFavorite).length
      if (q.get('favoritesOnly') === 'true') rows = rows.filter(s => s.isFavorite)
      if (search) rows = rows.filter(s => s.songTitle.toLowerCase().includes(search) || s.artist.toLowerCase().includes(search))
      const slice = rows.slice((page - 1) * limit, page * limit)
      return reply(slice, sendHeaders ? { 'X-Total-Count': String(rows.length), 'X-Favorite-Count': String(favorites) } : {})
    }
    return reply([])
  }) as any
}

const pageRequests = () => calls.filter(c => c.url.includes('/my-songs/') && c.method === 'GET').map(c => new URL(c.url).searchParams)

beforeEach(() => {
  localStorage.getItem = vi.fn((k: string) => (k === 'token' ? 'test-token' : null))
  localStorage.setItem = vi.fn()
  localStorage.removeItem = vi.fn()
  calls = []
  sendHeaders = true
  catalog = []
  installServer()
})

afterEach(() => vi.clearAllMocks())

const open = async () => {
  render(<SongManagement profileId={PROFILE} />)
  // someone who already has songs lands on their catalog
  await screen.findByRole('group', { name: 'Show songs' })
}

describe('SongManagement, the catalog', () => {
  it('opens on the catalog when the performer already has songs, first page of 20', async () => {
    catalog = makeSongs(45)
    await open()

    expect(await screen.findByText('Song 0001')).toBeInTheDocument()
    expect(screen.getByText('Song 0020')).toBeInTheDocument()
    expect(screen.queryByText('Song 0021')).toBeNull()
    expect(screen.getByText('1 to 20 of 45 songs')).toBeInTheDocument()
  })

  it('reaches the last song of the catalog with Next, and Next then stops', async () => {
    catalog = makeSongs(45)
    await open()
    await screen.findByText('Song 0001')

    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    await screen.findByText('Song 0021')
    expect(screen.getByText('21 to 40 of 45 songs')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(await screen.findByText('Song 0045')).toBeInTheDocument() // the very last song is reachable
    expect(screen.getByText('41 to 45 of 45 songs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled()
    expect(pageRequests().some(q => q.get('page') === '3' && q.get('limit') === '20')).toBe(true)
  })

  it('goes back with Previous', async () => {
    catalog = makeSongs(45)
    await open()
    await screen.findByText('Song 0001')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    await screen.findByText('Song 0021')

    fireEvent.click(screen.getByRole('button', { name: /Previous/ }))

    expect(await screen.findByText('Song 0001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled()
  })

  it('counts a big catalog in full: 1500 songs is 1500, not capped at 1000', async () => {
    catalog = makeSongs(1500)
    await open()

    expect(await screen.findByText('All songs (1500)')).toBeInTheDocument()
    expect(screen.getByText('1 to 20 of 1500 songs')).toBeInTheDocument()
    // the count comes from the server's total: no request ever asks for a capped 1000
    expect(calls.some(c => c.url.includes('limit=1000'))).toBe(false)
  })

  it('does not list a short catalog as paged: 12 songs, no Next button', async () => {
    catalog = makeSongs(12)
    await open()

    expect(await screen.findByText('Song 0012')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next/ })).toBeNull()
  })

  it('shows the favorites count from the server, and the filter asks for favorites only', async () => {
    catalog = makeSongs(30, 5) // every fifth song is a favorite: 6 of them
    await open()

    expect(await screen.findByText('Favorites (6)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Favorites \(6\)/ }))

    await waitFor(() => expect(pageRequests().some(q => q.get('favoritesOnly') === 'true')).toBe(true))
    expect(await screen.findByText('Song 0001')).toBeInTheDocument() // song 1 is a favorite
    expect(screen.queryByText('Song 0002')).toBeNull()
  })

  it('searches the catalog on the server and starts again from the first page', async () => {
    catalog = makeSongs(60)
    await open()
    await screen.findByText('Song 0001')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    await screen.findByText('Song 0021')

    fireEvent.change(screen.getByLabelText('Search your catalog'), { target: { value: 'Song 0055' } })
    fireEvent.submit(screen.getByLabelText('Search your catalog').closest('form')!)

    expect(await screen.findByText('Song 0055')).toBeInTheDocument()
    const last = pageRequests().at(-1)!
    expect(last.get('search')).toBe('Song 0055')
  })

  it('removes a song and the list and the count follow', async () => {
    catalog = makeSongs(25)
    await open()
    await screen.findByText('Song 0003')

    fireEvent.click(screen.getByRole('button', { name: 'Remove Song 0003' }))

    await waitFor(() => expect(screen.queryByText('Song 0003')).toBeNull())
    expect(calls.some(c => c.method === 'DELETE' && c.url.includes('/api/songcatalog/song-2'))).toBe(true)
    expect(await screen.findByText('All songs (24)')).toBeInTheDocument()
  })

  it('marks a song as a favorite and saves it', async () => {
    catalog = makeSongs(10)
    await open()
    await screen.findByText('Song 0002')

    fireEvent.click(screen.getByRole('button', { name: 'Mark Song 0002 as a favorite' }))

    await waitFor(() => expect(calls.some(c => c.method === 'PUT' && /song-1\/favorite/.test(c.url))).toBe(true))
    expect(await screen.findByText('Favorites (1)')).toBeInTheDocument()
  })

  it('says so when there are no songs yet, and offers to find some', async () => {
    catalog = []
    render(<SongManagement profileId={PROFILE} />)

    // no songs: it stays on the search view, and the catalog tab says it is empty
    fireEvent.click(await screen.findByRole('tab', { name: /My catalog/ }))
    expect(await screen.findByText('No songs in your catalog yet')).toBeInTheDocument()
  })
})

describe('SongManagement, when the browser cannot read the total', () => {
  it('still counts the catalog, from one request for the most the server returns, never a smaller cap', async () => {
    catalog = makeSongs(1500)
    sendHeaders = false
    await open()

    expect(await screen.findByText('All songs (1500)')).toBeInTheDocument()
    expect(calls.some(c => c.url.includes('limit=5000'))).toBe(true)
    expect(calls.some(c => c.url.includes('limit=1000'))).toBe(false)
  })
})
