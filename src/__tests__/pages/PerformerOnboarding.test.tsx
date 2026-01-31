import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import PerformerOnboarding from '@/pages/PerformerOnboarding'

vi.mock('@/utils/config', () => ({
  API_BASE_URL: 'http://localhost:3000/api'
}))

vi.mock('@stripe/react-stripe-js', () => ({
  useStripe: vi.fn(() => ({
    confirmIdentification: vi.fn()
  }))
}))

describe('Performer Onboarding - Complete Flow', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Profile Creation Step', () => {
    it('displays profile creation form', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perf-1', firstName: 'John' })
      })

      render(<PerformerOnboarding />)

      expect(screen.getByPlaceholderText(/first name/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/last name/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/email|bio/i)).toBeInTheDocument()
    })

    it('validates required fields', async () => {
      render(<PerformerOnboarding />)

      const submitButton = screen.getByRole('button', { name: /next|continue|create/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/required|please fill/i)).toBeInTheDocument()
      })
    })

    it('creates performer profile', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perf-1', firstName: 'John', lastName: 'Doe' })
      })

      render(<PerformerOnboarding />)

      await userEvent.type(screen.getByPlaceholderText(/first name/i), 'John')
      await userEvent.type(screen.getByPlaceholderText(/last name/i), 'Doe')
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'john@example.com')

      const submitButton = screen.getByRole('button', { name: /next|continue|create/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/performer'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('John')
          })
        )
      })
    })

    it('displays validation for invalid email', async () => {
      render(<PerformerOnboarding />)

      await userEvent.type(screen.getByPlaceholderText(/first name/i), 'John')
      await userEvent.type(screen.getByPlaceholderText(/last name/i), 'Doe')
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'invalid-email')

      const submitButton = screen.getByRole('button', { name: /next|continue|create/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid email|email format/i)).toBeInTheDocument()
      })
    })
  })

  describe('Stripe Connect Setup', () => {
    it('displays Stripe Connect button after profile creation', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perf-1', firstName: 'John' })
      })

      render(<PerformerOnboarding />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stripe|connect|bank/i })).toBeInTheDocument()
      })
    })

    it('initiates Stripe Connect flow', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'perf-1', firstName: 'John' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            url: 'https://connect.stripe.com/oauth/authorize?client_id=test'
          })
        })

      render(<PerformerOnboarding />)

      const stripeButton = await screen.findByRole('button', { name: /stripe|connect|bank/i })
      await userEvent.click(stripeButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/performer/setup-stripe-connect'),
          expect.any(Object)
        )
      })
    })

    it('handles Stripe Connect callback', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'perf-1', stripeAccountId: 'acct_test123' })
        })

      // Simulate return from Stripe Connect
      global.window.location.search = '?authorization_code=auth_code_123'

      render(<PerformerOnboarding />)

      await waitFor(() => {
        expect(screen.getByText(/account connected|stripe verified/i)).toBeInTheDocument()
      })
    })

    it('displays error if Stripe Connect fails', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'perf-1', firstName: 'John' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Stripe connection failed' })
        })

      render(<PerformerOnboarding />)

      const stripeButton = await screen.findByRole('button', { name: /stripe|connect|bank/i })
      await userEvent.click(stripeButton)

      await waitFor(() => {
        expect(screen.getByText(/error|failed|connection/i)).toBeInTheDocument()
      })
    })
  })

  describe('Enable Tipping', () => {
    it('displays tipping settings after Stripe is connected', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'perf-1',
          firstName: 'John',
          stripeAccountId: 'acct_test123'
        })
      })

      render(<PerformerOnboarding />)

      await waitFor(() => {
        expect(screen.getByText(/enable tipping|accept tips/i)).toBeInTheDocument()
      })
    })

    it('allows toggling tipping on/off', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'perf-1',
          stripeAccountId: 'acct_test123',
          tippingEnabled: false
        })
      })

      render(<PerformerOnboarding />)

      const tippingToggle = await screen.findByRole('checkbox', { name: /tipping|tips/i })
      expect(tippingToggle).not.toBeChecked()

      await userEvent.click(tippingToggle)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/performer/enable-tipping'),
          expect.any(Object)
        )
      })
    })

    it('displays QR code after tipping is enabled', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'perf-1',
            stripeAccountId: 'acct_test123',
            tippingEnabled: true,
            qrCodeUrl: 'https://example.com/qr-code.png'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ qrCodeUrl: 'https://example.com/qr-code.png' })
        })

      render(<PerformerOnboarding />)

      await waitFor(() => {
        const qrImage = screen.queryByAltText(/qr|code|scan/i)
        expect(qrImage).toBeInTheDocument()
      })
    })

    it('allows downloading QR code', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'perf-1',
          qrCodeUrl: 'https://example.com/qr-code.png'
        })
      })

      render(<PerformerOnboarding />)

      await waitFor(() => {
        const downloadButton = screen.queryByRole('button', { name: /download|save|qr/i })
        expect(downloadButton).toBeInTheDocument()
      })
    })
  })

  describe('Device Registration', () => {
    it('displays device registration form', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'perf-1',
          tippingEnabled: true
        })
      })

      render(<PerformerOnboarding />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/device name|location/i)).toBeInTheDocument()
      })
    })

    it('registers a new device', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'perf-1', tippingEnabled: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'device-1', uuid: 'device-uuid-123' })
        })

      render(<PerformerOnboarding />)

      await userEvent.type(screen.getByPlaceholderText(/device name/i), 'Main Stage')

      const registerButton = screen.getByRole('button', { name: /register|add device/i })
      await userEvent.click(registerButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/devices'),
          expect.objectContaining({
            method: 'POST'
          })
        )
      })
    })
  })

  describe('Song Catalog Setup', () => {
    it('displays song upload interface', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perf-1', tippingEnabled: true })
      })

      render(<PerformerOnboarding />)

      await waitFor(() => {
        expect(screen.getByText(/upload|songs|catalog/i)).toBeInTheDocument()
      })
    })

    it('allows uploading songs via CSV', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perf-1' })
      })

      render(<PerformerOnboarding />)

      const file = new File(
        ['title,artist\nSong 1,Artist 1\nSong 2,Artist 2'],
        'songs.csv',
        { type: 'text/csv' }
      )

      const input = screen.getByRole('button', { name: /upload|csv/i })
      await userEvent.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText(/Song 1|Song 2/)).toBeInTheDocument()
      })
    })

    it('displays upload progress', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'perf-1' })
      })

      render(<PerformerOnboarding />)

      const file = new File(['title,artist\nSong 1,Artist 1'], 'songs.csv', {
        type: 'text/csv'
      })

      const input = screen.getByRole('button', { name: /upload|csv/i })
      await userEvent.upload(input, file)

      await waitFor(() => {
        expect(screen.getByText(/uploading|progress|complete/i)).toBeInTheDocument()
      })
    })
  })

  describe('Completion', () => {
    it('displays success message when onboarding is complete', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })

      render(<PerformerOnboarding />)

      await waitFor(() => {
        expect(screen.getByText(/welcome|success|ready|complete/i)).toBeInTheDocument()
      })
    })

    it('redirects to dashboard after completion', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })

      const mockNavigate = vi.fn()
      vi.mock('react-router-dom', () => ({
        useNavigate: () => mockNavigate
      }))

      render(<PerformerOnboarding />)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })
  })
})
