import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SongPickerSheet } from '@/components/tip/SongPickerSheet'

vi.mock('@/utils/config', () => ({
  getApiBaseUrl: () => 'http://api.test',
  API_BASE_URL: 'http://api.test'
}))

const songs = [
  { id: 's1', songTitle: 'Blinding Lights', artist: 'The Weeknd' },
  { id: 's2', songTitle: 'Easy On Me', artist: 'Adele' }
]

const respondWith = (list: unknown[]) => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => list }) as any
}

describe('SongPickerSheet', () => {
  beforeEach(() => respondWith(songs))

  it('lists the catalog straight away, without typing', async () => {
    render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
    expect(await screen.findByText('Blinding Lights')).toBeInTheDocument()
    expect(screen.getByText('Adele')).toBeInTheDocument()
    const url = (global.fetch as any).mock.calls[0][0] as string
    expect(url).toContain('/api/songcatalog/performer/dev-1')
    expect(url).not.toContain('search=')
  })

  it('does not load anything while closed', () => {
    render(<SongPickerSheet open={false} deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('narrows the list as the tipper types', async () => {
    render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
    await screen.findByText('Blinding Lights')
    fireEvent.change(screen.getByLabelText('Search songs or artists'), { target: { value: 'adele' } })
    await waitFor(() => {
      const urls = (global.fetch as any).mock.calls.map((c: any[]) => c[0] as string)
      expect(urls.some((u: string) => u.includes('search=adele'))).toBe(true)
    })
  })

  it('picks a song, takes an optional name and note, then hands it back', async () => {
    const onPick = vi.fn()
    render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={onPick} />)
    fireEvent.click(await screen.findByText('Easy On Me'))

    fireEvent.change(screen.getByPlaceholderText('Your name (optional)'), { target: { value: ' Sam ' } })
    fireEvent.change(screen.getByPlaceholderText('Add a note (optional)'), { target: { value: 'For my mum' } })
    fireEvent.click(screen.getByRole('button', { name: /Choose a tip amount/ }))

    expect(onPick).toHaveBeenCalledWith({
      id: 's2',
      title: 'Easy On Me',
      artist: 'Adele',
      requestorName: 'Sam',
      note: 'For my mum'
    })
  })

  it('leaves name and note out when they are blank', async () => {
    const onPick = vi.fn()
    render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={onPick} />)
    fireEvent.click(await screen.findByText('Blinding Lights'))
    fireEvent.click(screen.getByRole('button', { name: /Choose a tip amount/ }))
    expect(onPick).toHaveBeenCalledWith({ id: 's1', title: 'Blinding Lights', artist: 'The Weeknd', requestorName: undefined, note: undefined })
  })

  it('lets the tipper go back and choose a different song', async () => {
    render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
    fireEvent.click(await screen.findByText('Blinding Lights'))
    fireEvent.click(screen.getByRole('button', { name: 'Choose a different song' }))
    expect(await screen.findByText('Adele')).toBeInTheDocument()
  })

  it('explains an empty search and offers to show everything again', async () => {
    respondWith([])
    render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
    fireEvent.change(screen.getByLabelText('Search songs or artists'), { target: { value: 'zzz' } })
    expect(await screen.findByText(/No songs match/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show all songs' })).toBeInTheDocument()
  })

  it('closes from the close button', async () => {
    const onClose = vi.fn()
    render(<SongPickerSheet open deviceUuid="dev-1" onClose={onClose} onPick={() => {}} />)
    fireEvent.click(await screen.findByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('marks songs the performer played recently, and still lets the tipper choose them', async () => {
    respondWith([
      { id: 's1', songTitle: 'Blinding Lights', artist: 'The Weeknd', playedMinutesAgo: 25 },
      { id: 's2', songTitle: 'Easy On Me', artist: 'Adele', playedMinutesAgo: null }
    ])
    render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
    expect(await screen.findByText('Played 25 min ago')).toBeInTheDocument()
    expect(screen.getAllByText(/^Played /)).toHaveLength(1)

    fireEvent.click(screen.getByText('Blinding Lights'))
    expect(screen.getByText(/You can still request it/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose a tip amount/ })).toBeInTheDocument()
  })

  describe('artist favorites', () => {
    const withFavorites = [
      { id: 'f1', songTitle: 'Superstition', artist: 'Stevie Wonder', isFavorite: true },
      { id: 's1', songTitle: 'Blinding Lights', artist: 'The Weeknd' },
      { id: 's2', songTitle: 'Easy On Me', artist: 'Adele' }
    ]

    it('puts favorites in their own section on top, marked in plain words, with the rest under All songs', async () => {
      respondWith(withFavorites)
      render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)

      expect(await screen.findByText('Superstition')).toBeInTheDocument()
      expect(screen.getByText('Songs they do best')).toBeInTheDocument()
      // The heading says it once; the row does not repeat the label
      expect(screen.getByText('Artist favorites')).toBeInTheDocument()
      expect(screen.queryByText('Artist favorite')).toBeNull()
      expect(screen.getByText('All songs')).toBeInTheDocument()
      const rows = screen.getAllByRole('button').filter(b => /Superstition|Blinding|Easy/.test(b.textContent || ''))
      expect(rows[0]).toHaveAttribute('data-favorite', 'true')
      expect(rows[1]).not.toHaveAttribute('data-favorite')
    })

    it('has no favorites section when the performer has none', async () => {
      render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
      await screen.findByText('Blinding Lights')
      expect(screen.queryByText('Songs they do best')).toBeNull()
      expect(screen.queryByText('All songs')).toBeNull()
    })

    it('keeps one list while searching, with the favorite still marked', async () => {
      respondWith(withFavorites)
      render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
      await screen.findByText('Superstition')
      fireEvent.change(screen.getByLabelText('Search songs or artists'), { target: { value: 's' } })

      await waitFor(() => expect(screen.queryByText('Songs they do best')).toBeNull())
      expect(screen.getByText('Artist favorite')).toBeInTheDocument()
    })

    it('tells the tipper when the song they chose is a favorite', async () => {
      respondWith(withFavorites)
      render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
      fireEvent.click(await screen.findByText('Superstition'))

      expect(await screen.findByText(/One of the songs they do best/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Choose a tip amount/ })).toBeInTheDocument()
    })

    it('says nothing about favorites for an ordinary song', async () => {
      respondWith(withFavorites)
      render(<SongPickerSheet open deviceUuid="dev-1" onClose={() => {}} onPick={() => {}} />)
      fireEvent.click(await screen.findByText('Easy On Me'))
      await screen.findByRole('button', { name: /Choose a tip amount/ })
      expect(screen.queryByText(/One of the songs they do best/)).toBeNull()
    })
  })
})
