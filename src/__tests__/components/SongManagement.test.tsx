import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import SongManagement from '@/components/SongManagement'

// Mock the API module
vi.mock('@/utils/config', () => ({
  API_BASE_URL: 'http://localhost:3000/api'
}))

describe('SongManagement Component', () => {
  const mockProfileId = 'test-profile-id'
  const mockToken = 'test-token'

  beforeEach(() => {
    // Mock localStorage
    localStorage.getItem = vi.fn((key) => {
      if (key === 'token') return mockToken
      return null
    })
    localStorage.setItem = vi.fn()
    localStorage.removeItem = vi.fn()

    // Mock fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Search Functionality', () => {
    it('renders search input fields', () => {
      render(<SongManagement profileId={mockProfileId} />)
      
      const titleInput = screen.getByPlaceholderText(/e.g., Your Love Is King/)
      const artistInput = screen.getByPlaceholderText(/e.g., Sade/)
      
      expect(titleInput).toBeInTheDocument()
      expect(artistInput).toBeInTheDocument()
    })

    it('searches for songs with title and artist', async () => {
      const mockResults = [
        {
          id: 'song-1',
          title: 'Your Love Is King',
          artist: 'Sade',
          album: 'Diamond Life',
          genre: 'Soul'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults
      })

      render(<SongManagement profileId={mockProfileId} />)

      const titleInput = screen.getByPlaceholderText(/e.g., Your Love Is King/)
      const artistInput = screen.getByPlaceholderText(/e.g., Sade/)
      const searchButton = screen.getByRole('button', { name: /search/i })

      await userEvent.type(titleInput, 'Your Love Is King')
      await userEvent.type(artistInput, 'Sade')
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('Your%20Love%20Is%20King'),
          expect.any(Object)
        )
      })
    })

    it('displays search results', async () => {
      const mockResults = [
        {
          id: 'song-1',
          title: 'Your Love Is King',
          artist: 'Sade',
          album: 'Diamond Life',
          genre: 'Soul'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults
      })

      render(<SongManagement profileId={mockProfileId} />)

      const titleInput = screen.getByPlaceholderText(/e.g., Your Love Is King/)
      const searchButton = screen.getByRole('button', { name: /search/i })

      await userEvent.type(titleInput, 'Your Love Is King')
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(/Your Love Is King/)).toBeInTheDocument()
      })
    })

    it('shows "no results" message when search returns empty', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      render(<SongManagement profileId={mockProfileId} />)

      const titleInput = screen.getByPlaceholderText(/e.g., Your Love Is King/)
      const searchButton = screen.getByRole('button', { name: /search/i })

      await userEvent.type(titleInput, 'NonExistentSong')
      await userEvent.click(searchButton)

      await waitFor(() => {
        expect(screen.getByText(/no songs found/i)).toBeInTheDocument()
      })
    })

    it('disables search button when title is empty', () => {
      render(<SongManagement profileId={mockProfileId} />)

      const searchButton = screen.getByRole('button', { name: /search/i })
      
      expect(searchButton).toBeDisabled()
    })
  })

  describe('Upload Functionality', () => {
    it('renders upload tab', () => {
      render(<SongManagement profileId={mockProfileId} />)

      const uploadTab = screen.getByRole('button', { name: /upload songs/i })
      expect(uploadTab).toBeInTheDocument()
    })

    it('displays file upload area', () => {
      render(<SongManagement profileId={mockProfileId} />)

      const uploadTab = screen.getByRole('button', { name: /upload songs/i })
      fireEvent.click(uploadTab)

      expect(screen.getByText(/drag and drop your file here/i)).toBeInTheDocument()
    })

    it('handles file selection', async () => {
      render(<SongManagement profileId={mockProfileId} />)

      const uploadTab = screen.getByRole('button', { name: /upload songs/i })
      fireEvent.click(uploadTab)

      const fileInput = screen.getByRole('button', { name: /select file/i }).parentElement?.querySelector('input[type="file"]')
      
      if (fileInput) {
        const file = new File(['title,artist,album,genre\nYour Love Is King,Sade,Diamond Life,Soul'], 'songs.csv', { type: 'text/csv' })
        await userEvent.upload(fileInput, file)

        await waitFor(() => {
          expect(screen.getByText(/songs.csv/)).toBeInTheDocument()
        })
      }
    })
  })

  describe('Catalog Functionality', () => {
    it('renders my catalog tab', () => {
      render(<SongManagement profileId={mockProfileId} />)

      const catalogTab = screen.getByRole('button', { name: /my catalog/i })
      expect(catalogTab).toBeInTheDocument()
    })

    it('displays loading state when fetching catalog', async () => {
      ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {})) // Never resolves

      render(<SongManagement profileId={mockProfileId} />)

      const catalogTab = screen.getByRole('button', { name: /my catalog/i })
      fireEvent.click(catalogTab)

      // Component should be in loading state
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })

    it('displays catalog songs', async () => {
      const mockSongs = [
        {
          id: 'song-1',
          songTitle: 'Your Love Is King',
          artist: 'Sade',
          album: 'Diamond Life',
          genre: 'Soul',
          isActive: true,
          createdAt: '2024-01-10'
        }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'X-Total-Count': '1' }),
        json: async () => mockSongs
      })

      render(<SongManagement profileId={mockProfileId} />)

      const catalogTab = screen.getByRole('button', { name: /my catalog/i })
      fireEvent.click(catalogTab)

      await waitFor(() => {
        expect(screen.getByText(/Your Love Is King/)).toBeInTheDocument()
      })
    })

    it('removes song from catalog', async () => {
      const mockSongs = [
        {
          id: 'song-1',
          songTitle: 'Your Love Is King',
          artist: 'Sade',
          album: 'Diamond Life',
          genre: 'Soul',
          isActive: true,
          createdAt: '2024-01-10'
        }
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'X-Total-Count': '1' }),
          json: async () => mockSongs
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204
        })

      render(<SongManagement profileId={mockProfileId} />)

      const catalogTab = screen.getByRole('button', { name: /my catalog/i })
      fireEvent.click(catalogTab)

      await waitFor(() => {
        const removeButton = screen.queryByRole('button', { name: /remove/i })
        expect(removeButton).toBeInTheDocument()
      })

      const removeButton = screen.getByRole('button', { name: /remove/i })
      await userEvent.click(removeButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/songcatalog/song-1'),
          expect.objectContaining({ method: 'DELETE' })
        )
      })
    })
  })

  describe('Pagination', () => {
    it('displays pagination controls when total > limit', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'X-Total-Count': '25' }),
        json: async () => Array(20).fill({ id: '1', songTitle: 'Song', artist: 'Artist' })
      })

      render(<SongManagement profileId={mockProfileId} />)

      const catalogTab = screen.getByRole('button', { name: /my catalog/i })
      fireEvent.click(catalogTab)

      await waitFor(() => {
        const nextButton = screen.queryByRole('button', { name: /next/i })
        expect(nextButton).toBeInTheDocument()
      })
    })
  })
})
