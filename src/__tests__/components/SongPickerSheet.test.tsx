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
})
