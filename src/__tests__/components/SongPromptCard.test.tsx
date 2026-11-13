import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SongPromptCard from '@/components/SongPromptCard'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))

beforeEach(() => {
  api.get.mockResolvedValue({ data: { askForSongFirst: false } })
  api.put.mockImplementation(async (_u: string, body: { askForSongFirst: boolean }) => ({ data: { askForSongFirst: body.askForSongFirst } }))
})

describe('SongPromptCard', () => {
  it('starts off', async () => {
    render(<SongPromptCard />)
    const toggle = await screen.findByRole('switch', { name: 'Ask tippers if they want to request a song' })
    await waitFor(() => expect(toggle).not.toBeDisabled())
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('turns on and saves', async () => {
    render(<SongPromptCard />)
    const toggle = await screen.findByRole('switch', { name: 'Ask tippers if they want to request a song' })
    await waitFor(() => expect(toggle).not.toBeDisabled())
    fireEvent.click(toggle)
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/profiles/me/song-prompt', { askForSongFirst: true }))
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
  })

  it('shows a saved "on" when it opens', async () => {
    api.get.mockResolvedValue({ data: { askForSongFirst: true } })
    render(<SongPromptCard />)
    const toggle = await screen.findByRole('switch', { name: 'Ask tippers if they want to request a song' })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
  })

  it('puts the switch back and says so when saving fails', async () => {
    api.put.mockResolvedValue({ error: 'nope' })
    render(<SongPromptCard />)
    const toggle = await screen.findByRole('switch', { name: 'Ask tippers if they want to request a song' })
    await waitFor(() => expect(toggle).not.toBeDisabled())
    fireEvent.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
