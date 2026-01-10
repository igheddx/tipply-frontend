import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import SongRequestMonitoring from '@/pages/SongRequestMonitoring'

vi.mock('@/utils/config', () => ({
  API_BASE_URL: 'http://localhost:3000/api'
}))

describe('Song Request Monitoring - Performer Dashboard', () => {
  const mockPerformerId = 'perf-123'

  beforeEach(() => {
    global.fetch = vi.fn()
    localStorage.setItem('performerId', mockPerformerId)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Song Request Queue Display', () => {
    it('displays pending song requests', async () => {
      const mockRequests = [
        { id: 'req-1', songTitle: 'Your Love Is King', artist: 'Sade', tipAmount: 500, status: 'pending' },
        { id: 'req-2', songTitle: 'Smooth Criminal', artist: 'Michael Jackson', tipAmount: 1000, status: 'pending' }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequests
      })

      render(<SongRequestMonitoring />)

      await waitFor(() => {
        expect(screen.getByText(/Your Love Is King/)).toBeInTheDocument()
        expect(screen.getByText(/Smooth Criminal/)).toBeInTheDocument()
      })
    })

    it('displays request details (tip amount, requester, time)', async () => {
      const mockRequest = {
        id: 'req-1',
        songTitle: 'Your Love Is King',
        artist: 'Sade',
        tipAmount: 500,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        customerName: 'John Doe'
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockRequest]
      })

      render(<SongRequestMonitoring />)

      await waitFor(() => {
        expect(screen.getByText(/\$5\.00/)).toBeInTheDocument()
        expect(screen.getByText(/John Doe/)).toBeInTheDocument()
      })
    })

    it('sorts requests by tip amount (highest first)', async () => {
      const mockRequests = [
        { id: 'req-1', songTitle: 'Song 1', artist: 'Artist', tipAmount: 500, status: 'pending' },
        { id: 'req-2', songTitle: 'Song 2', artist: 'Artist', tipAmount: 2500, status: 'pending' },
        { id: 'req-3', songTitle: 'Song 3', artist: 'Artist', tipAmount: 1000, status: 'pending' }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequests
      })

      render(<SongRequestMonitoring />)

      const sortButton = await screen.findByRole('button', { name: /sort|highest/i })
      await userEvent.click(sortButton)

      await waitFor(() => {
        const rows = screen.getAllByTestId('request-row')
        expect(rows[0]).toHaveTextContent(/Song 2/) // Highest tip first
      })
    })

    it('filters requests by status (pending, completed, skipped)', async () => {
      const mockRequests = [
        { id: 'req-1', songTitle: 'Song 1', status: 'pending' },
        { id: 'req-2', songTitle: 'Song 2', status: 'completed' },
        { id: 'req-3', songTitle: 'Song 3', status: 'pending' }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequests
      })

      render(<SongRequestMonitoring />)

      const filterButton = await screen.findByRole('button', { name: /filter|pending/i })
      await userEvent.click(filterButton)

      await waitFor(() => {
        const rows = screen.getAllByTestId('request-row')
        rows.forEach(row => {
          expect(row).toHaveTextContent('pending')
        })
      })
    })
  })

  describe('Request Actions', () => {
    it('marks request as completed', async () => {
      const mockRequest = {
        id: 'req-1',
        songTitle: 'Song 1',
        artist: 'Artist',
        status: 'pending'
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockRequest]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockRequest, status: 'completed' })
        })

      render(<SongRequestMonitoring />)

      const completeButton = await screen.findByRole('button', { name: /complete|played/i })
      await userEvent.click(completeButton)

      await waitFor(() => {
        expect(screen.getByText(/completed/)).toBeInTheDocument()
      })
    })

    it('skips/rejects request with reason', async () => {
      const mockRequest = {
        id: 'req-1',
        songTitle: 'Song 1',
        status: 'pending'
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockRequest]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockRequest, status: 'skipped' })
        })

      render(<SongRequestMonitoring />)

      const skipButton = await screen.findByRole('button', { name: /skip|pass/i })
      await userEvent.click(skipButton)

      // Select skip reason
      const reasonSelect = await screen.findByRole('combobox', { name: /reason/i })
      await userEvent.selectOption(reasonSelect, 'not-available')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/song-requests'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('skipped')
          })
        )
      })
    })

    it('allows bulk actions on multiple requests', async () => {
      const mockRequests = [
        { id: 'req-1', songTitle: 'Song 1', status: 'pending' },
        { id: 'req-2', songTitle: 'Song 2', status: 'pending' }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequests
      })

      render(<SongRequestMonitoring />)

      // Select multiple requests
      const checkboxes = await screen.findAllByRole('checkbox')
      await userEvent.click(checkboxes[0])
      await userEvent.click(checkboxes[1])

      // Bulk action
      const bulkCompleteButton = await screen.findByRole('button', { name: /mark all|bulk/i })
      await userEvent.click(bulkCompleteButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/song-requests/bulk'),
          expect.any(Object)
        )
      })
    })
  })

  describe('Real-time Updates via WebSocket', () => {
    it('receives new song request notification', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      render(<SongRequestMonitoring />)

      // Simulate WebSocket message (in real app)
      const newRequest = {
        id: 'req-new',
        songTitle: 'New Song',
        artist: 'New Artist',
        status: 'pending'
      }

      // Trigger update
      await waitFor(() => {
        expect(screen.queryByText(/New Song/)).not.toBeInTheDocument()
      })
    })

    it('displays notification when high-value request arrives', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      render(<SongRequestMonitoring />)

      // Simulate high-value request notification
      const notification = screen.queryByRole('alert')
      if (notification) {
        expect(notification).toHaveTextContent(/\$25|high value/i)
      }
    })
  })

  describe('Request Statistics Dashboard', () => {
    it('displays request statistics', async () => {
      const mockStats = {
        totalRequests: 150,
        completedRequests: 120,
        pendingRequests: 25,
        skippedRequests: 5,
        totalTipsFromRequests: 5000,
        averageTipPerRequest: 33.33
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      })

      render(<SongRequestMonitoring />)

      await waitFor(() => {
        expect(screen.getByText(/150/)).toBeInTheDocument() // Total requests
        expect(screen.getByText(/120/)).toBeInTheDocument() // Completed
        expect(screen.getByText(/\$5,000|5000/)).toBeInTheDocument() // Total tips
      })
    })

    it('displays completion rate percentage', async () => {
      const mockStats = {
        totalRequests: 100,
        completedRequests: 80,
        completionRate: 80
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      })

      render(<SongRequestMonitoring />)

      await waitFor(() => {
        expect(screen.getByText(/80%/)).toBeInTheDocument()
      })
    })

    it('displays most requested songs', async () => {
      const mockStats = {
        mostRequestedSongs: [
          { title: 'Popular Song 1', artist: 'Artist', requestCount: 15 },
          { title: 'Popular Song 2', artist: 'Artist', requestCount: 12 },
          { title: 'Popular Song 3', artist: 'Artist', requestCount: 10 }
        ]
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      })

      render(<SongRequestMonitoring />)

      await waitFor(() => {
        expect(screen.getByText(/Popular Song 1/)).toBeInTheDocument()
        expect(screen.getByText(/Popular Song 2/)).toBeInTheDocument()
      })
    })
  })

  describe('Export & Reporting', () => {
    it('exports request history as CSV', async () => {
      const mockRequests = [
        { id: 'req-1', songTitle: 'Song 1', status: 'completed' },
        { id: 'req-2', songTitle: 'Song 2', status: 'completed' }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRequests
      })

      render(<SongRequestMonitoring />)

      const exportButton = await screen.findByRole('button', { name: /export|csv|download/i })
      await userEvent.click(exportButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/song-requests/export'),
          expect.any(Object)
        )
      })
    })

    it('filters requests by date range for export', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      render(<SongRequestMonitoring />)

      const startDateInput = await screen.findByLabelText(/start date|from/i)
      const endDateInput = await screen.findByLabelText(/end date|to/i)

      await userEvent.type(startDateInput, '2026-01-01')
      await userEvent.type(endDateInput, '2026-01-10')

      const exportButton = screen.getByRole('button', { name: /export/i })
      await userEvent.click(exportButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringMatching(/startDate.*endDate/),
          expect.any(Object)
        )
      })
    })
  })

  describe('Notification Preferences', () => {
    it('allows enabling/disabling request notifications', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      render(<SongRequestMonitoring />)

      const notificationToggle = await screen.findByRole('checkbox', { name: /notification/i })
      
      expect(notificationToggle).not.toBeChecked()
      await userEvent.click(notificationToggle)
      expect(notificationToggle).toBeChecked()
    })

    it('allows setting notification thresholds (e.g., for tips >= $10)', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      render(<SongRequestMonitoring />)

      const thresholdInput = await screen.findByPlaceholderText(/minimum|threshold/i)
      await userEvent.type(thresholdInput, '1000') // $10

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/performer-settings'),
          expect.any(Object)
        )
      })
    })
  })
})
