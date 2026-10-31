import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import PerformerSongRequests from '../../components/PerformerSongRequests'
import { apiService } from '../../services/api'

vi.mock('../../services/api', () => ({ apiService: { get: vi.fn() } }))

const row = (n: number, over: object = {}) => ({
  id: `r${n}`, songTitle: `Song ${n}`, artist: 'Artist', amount: 5, sentAt: '2026-10-31T02:30:00Z', status: 'pending', performed: false, ...over
})

describe('PerformerSongRequests', () => {
  beforeEach(() => vi.mocked(apiService.get).mockReset())

  it('shows song, amount, time and whether it was performed, with a summary', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { date: '2026-10-30', total: 2, performed: 1, totalAmount: 15, page: 1, pageSize: 10,
        items: [row(1, { amount: 10, status: 'completed', performed: true }), row(2)] }
    } as any)
    render(<PerformerSongRequests profileId="p1" />)

    expect(await screen.findByText('Song 1')).toBeInTheDocument()
    expect(screen.getByText('$10.00')).toBeInTheDocument()
    expect(screen.getByText('Performed')).toBeInTheDocument()
    expect(screen.getByText('Not performed yet')).toBeInTheDocument()
    expect(screen.getByText(/2 requested · 1 performed · \$15\.00 in tips/)).toBeInTheDocument()
    expect(apiService.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/admin\/performers\/p1\/song-requests\?date=\d{4}-\d{2}-\d{2}&timezoneOffsetMinutes=-?\d+&page=1&pageSize=10/))
  })

  it('asks for the next page when paginating', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { date: '2026-10-30', total: 23, performed: 0, totalAmount: 0, page: 1, pageSize: 10, items: Array.from({ length: 10 }, (_, i) => row(i + 1)) }
    } as any)
    render(<PerformerSongRequests profileId="p1" />)
    await screen.findByText('Song 1')
    fireEvent.click(screen.getByTitle('2'))
    await waitFor(() => expect(apiService.get).toHaveBeenLastCalledWith(expect.stringContaining('page=2')))
  })

  it('says so when there are no requests today', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { date: '2026-10-30', total: 0, performed: 0, totalAmount: 0, page: 1, pageSize: 10, items: [] } } as any)
    render(<PerformerSongRequests profileId="p1" />)
    expect(await screen.findByText('No song requests today')).toBeInTheDocument()
  })
})
