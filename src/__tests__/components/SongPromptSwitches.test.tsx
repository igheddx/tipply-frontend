import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DeviceSongPromptSwitch from '@/components/DeviceSongPromptSwitch'
import VenueSongPromptSwitch from '@/components/venue/VenueSongPromptSwitch'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), updateSongPromptSetting: vi.fn() }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))

describe('DeviceSongPromptSwitch (under a device\'s "Song requests")', () => {
  beforeEach(() => {
    api.updateSongPromptSetting.mockReset()
    api.updateSongPromptSetting.mockImplementation(async (_id: string, value: boolean) => ({ data: { askForSongFirst: value } }))
  })

  it('shows the saved choice, off by default', () => {
    render(<DeviceSongPromptSwitch deviceId="d1" checked={false} onSaved={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Ask when an amount is tapped' })).toHaveAttribute('aria-checked', 'false')
  })

  it('turns on for that device and reports the saved value', async () => {
    const onSaved = vi.fn()
    render(<DeviceSongPromptSwitch deviceId="d1" checked={false} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Ask when an amount is tapped' }))

    await waitFor(() => expect(api.updateSongPromptSetting).toHaveBeenCalledWith('d1', true))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(true))
  })

  it('turns off from on', async () => {
    const onSaved = vi.fn()
    render(<DeviceSongPromptSwitch deviceId="d1" checked onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Ask when an amount is tapped' }))

    await waitFor(() => expect(api.updateSongPromptSetting).toHaveBeenCalledWith('d1', false))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(false))
  })

  it('says so and changes nothing when saving fails', async () => {
    api.updateSongPromptSetting.mockResolvedValue({ error: 'nope' })
    const onSaved = vi.fn()
    render(<DeviceSongPromptSwitch deviceId="d1" checked={false} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Ask when an amount is tapped' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe('VenueSongPromptSwitch (the performer\'s own choice for venue devices)', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: { askForSongFirst: false } })
    api.put.mockImplementation(async (_u: string, body: { askForSongFirst: boolean }) => ({ data: { askForSongFirst: body.askForSongFirst } }))
  })

  it('starts off and says it is the performer\'s own choice, not the venue\'s', async () => {
    render(<VenueSongPromptSwitch />)
    const toggle = await screen.findByRole('switch', { name: /Ask for a song when an amount is tapped, on venue devices/ })
    await waitFor(() => expect(toggle).not.toBeDisabled())
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/does not change the venue's settings/)).toBeInTheDocument()
  })

  it('saves to the performer\'s profile, not to any device', async () => {
    render(<VenueSongPromptSwitch />)
    const toggle = await screen.findByRole('switch', { name: /on venue devices/ })
    await waitFor(() => expect(toggle).not.toBeDisabled())
    fireEvent.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/profiles/me/venue-song-prompt', { askForSongFirst: true }))
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
  })

  it('shows a saved "on" when it opens, and puts the switch back when saving fails', async () => {
    api.get.mockResolvedValue({ data: { askForSongFirst: true } })
    api.put.mockResolvedValue({ error: 'nope' })
    render(<VenueSongPromptSwitch />)
    const toggle = await screen.findByRole('switch', { name: /on venue devices/ })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))

    fireEvent.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })
})
