import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import TippingInterface from '@/pages/TippingInterface'

// Mock the API module
vi.mock('@/utils/config', () => ({
  API_BASE_URL: 'http://localhost:3000/api'
}))

// Mock Stripe.js
vi.mock('@stripe/react-stripe-js', () => ({
  useStripe: vi.fn(() => ({
    confirmPayment: vi.fn()
  })),
  useElements: vi.fn(() => ({
    getElement: vi.fn()
  })),
  CardElement: () => <div>Card Element Mock</div>
}))

describe('Tipping Interface - Complete Flow', () => {
  const mockDeviceUuid = 'device-123'
  const mockPerformerName = 'Test Performer'

  beforeEach(() => {
    global.fetch = vi.fn()
    localStorage.getItem = vi.fn((key) => {
      if (key === 'deviceUuid') return mockDeviceUuid
      return null
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('QR Landing Page', () => {
    it('loads performer catalog via QR code', async () => {
      const mockDevice = {
        id: 'device-1',
        profile: {
          id: 'profile-1',
          firstName: 'Test',
          lastName: 'Performer'
        }
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevice
      })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/devices/${mockDeviceUuid}`),
          expect.any(Object)
        )
      })
    })

    it('displays performer name and profile', async () => {
      const mockDevice = {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          profileImageUrl: 'https://example.com/image.jpg'
        }
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevice
      })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument()
      })
    })

    it('displays available song catalog', async () => {
      const mockSongs = [
        { id: '1', songTitle: 'Song 1', artist: 'Artist 1' },
        { id: '2', songTitle: 'Song 2', artist: 'Artist 2' }
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: { firstName: 'Test' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSongs
        })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      await waitFor(() => {
        expect(screen.getByText(/Song 1/)).toBeInTheDocument()
        expect(screen.getByText(/Song 2/)).toBeInTheDocument()
      })
    })
  })

  describe('Tip Amount Entry', () => {
    it('allows user to enter custom tip amount', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile: { firstName: 'Test' } })
      })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      const amountInput = await screen.findByPlaceholderText(/amount|tip/i)
      await userEvent.type(amountInput, '500')

      expect(amountInput).toHaveValue(500)
    })

    it('validates minimum tip amount', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile: { firstName: 'Test' } })
      })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      const amountInput = await screen.findByPlaceholderText(/amount|tip/i)
      await userEvent.type(amountInput, '50') // Less than $1.00

      const submitButton = screen.getByRole('button', { name: /tip|pay/i })
      expect(submitButton).toBeDisabled()
    })

    it('displays preset tip amounts', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile: { firstName: 'Test' } })
      })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /\$5/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /\$10/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /\$25/ })).toBeInTheDocument()
      })
    })

    it('selects preset amount when clicked', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile: { firstName: 'Test' } })
      })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      const fiveButton = await screen.findByRole('button', { name: /\$5/ })
      await userEvent.click(fiveButton)

      const amountInput = screen.getByPlaceholderText(/amount|tip/i) as HTMLInputElement
      expect(amountInput.value).toBe('500') // 500 cents = $5
    })
  })

  describe('Payment Flow', () => {
    it('opens payment modal when tip button clicked', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile: { firstName: 'Test' } })
      })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      const fiveButton = await screen.findByRole('button', { name: /\$5/ })
      await userEvent.click(fiveButton)

      const payButton = screen.getByRole('button', { name: /pay|checkout|confirm/i })
      await userEvent.click(payButton)

      await waitFor(() => {
        expect(screen.getByText(/card|payment/i)).toBeInTheDocument()
      })
    })

    it('processes payment with Stripe', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: { firstName: 'Test' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ clientSecret: 'pi_test_secret_123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'tip-1', amount: 500, status: 'completed' })
        })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      const fiveButton = await screen.findByRole('button', { name: /\$5/ })
      await userEvent.click(fiveButton)

      const payButton = screen.getByRole('button', { name: /pay|checkout/i })
      await userEvent.click(payButton)

      // Payment Intent should be created
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/tips/create-payment-intent'),
          expect.any(Object)
        )
      })
    })

    it('handles payment errors gracefully', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: { firstName: 'Test' } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Payment failed' })
        })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      const fiveButton = await screen.findByRole('button', { name: /\$5/ })
      await userEvent.click(fiveButton)

      const payButton = screen.getByRole('button', { name: /pay|checkout/i })
      await userEvent.click(payButton)

      await waitFor(() => {
        expect(screen.getByText(/error|failed/i)).toBeInTheDocument()
      })
    })
  })

  describe('Confirmation Screen', () => {
    it('displays confirmation after successful payment', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: { firstName: 'Test' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ clientSecret: 'pi_test_secret_123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'tip-1', amount: 500, status: 'completed' })
        })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      const fiveButton = await screen.findByRole('button', { name: /\$5/ })
      await userEvent.click(fiveButton)

      const payButton = screen.getByRole('button', { name: /pay|checkout/i })
      await userEvent.click(payButton)

      await waitFor(() => {
        expect(screen.getByText(/thank you|success|confirmation/i)).toBeInTheDocument()
      })
    })

    it('shows tip amount and performer name in confirmation', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profile: { firstName: 'John', lastName: 'Doe' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ clientSecret: 'pi_test_secret_123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'tip-1', amount: 500, status: 'completed' })
        })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      const fiveButton = await screen.findByRole('button', { name: /\$5/ })
      await userEvent.click(fiveButton)

      const payButton = screen.getByRole('button', { name: /pay|checkout/i })
      await userEvent.click(payButton)

      await waitFor(() => {
        expect(screen.getByText(/\$5/)).toBeInTheDocument()
        expect(screen.getByText(/John Doe/)).toBeInTheDocument()
      })
    })

    it('allows requesting song after payment', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            profile: { firstName: 'Test' },
            songs: [{ id: '1', songTitle: 'Song 1', artist: 'Artist 1' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ clientSecret: 'pi_test_secret_123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'tip-1', amount: 500, status: 'completed' })
        })

      render(<TippingInterface deviceUuid={mockDeviceUuid} />)

      const fiveButton = await screen.findByRole('button', { name: /\$5/ })
      await userEvent.click(fiveButton)

      const payButton = screen.getByRole('button', { name: /pay|checkout/i })
      await userEvent.click(payButton)

      await waitFor(() => {
        const songRequestButton = screen.queryByRole('button', { name: /request|song/i })
        expect(songRequestButton).toBeInTheDocument()
      })
    })
  })
})
