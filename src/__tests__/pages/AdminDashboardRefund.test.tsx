import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminDashboard from '@/pages/AdminDashboard'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

const mockApiService = {
  getProfile: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn()
}

vi.mock('@/services/api', () => ({
  apiService: mockApiService
}))

describe('AdminDashboard refund flow', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token')
    mockApiService.getProfile.mockResolvedValue({ data: { role: 'root_admin' } })
    mockApiService.get.mockImplementation((url: string) => {
      if (url.includes('/api/admin/dashboard-stats')) {
        return Promise.resolve({ data: { totalUsers: 0, totalDevices: 0, totalTips: 0, totalRevenue: 0, totalPlatformFees: 0, totalStripeFees: 0, totalPerformerPayouts: 0, activePerformers: 0 } })
      }
      if (url.includes('/api/admin/performers')) {
        return Promise.resolve({ data: [] })
      }
      if (url.includes('/api/admin/platform-earnings')) {
        return Promise.resolve({ data: { totalPlatformFees: 0, totalStripeFees: 0, totalRevenue: 0, totalPerformerPayouts: 0 } })
      }
      if (url.includes('/api/admin/batch-status')) {
        return Promise.resolve({ data: { status: 'success', tipsProcessed: 0, tipsFailed: 0, tipsPending: 0, totalAmount: 0, isManual: false } })
      }
      if (url.includes('/api/admin/batch-history')) {
        return Promise.resolve({ data: { history: [] } })
      }
      if (url.includes('/api/stripe-config/mode')) {
        return Promise.resolve({ data: { mode: 'test', isProduction: false, canToggle: false } })
      }
      return Promise.resolve({ data: null })
    })
    mockApiService.post.mockImplementation((url: string) => {
      if (url.includes('/api/admin/tips/search')) {
        return Promise.resolve({
          data: {
            tips: [
              {
                id: 'tip-1',
                createdAt: new Date().toISOString(),
                amount: 12,
                deviceNickname: 'Stage',
                performerFirstName: 'Jane',
                performerLastName: 'Doe',
                performerEmail: 'jane@example.com',
                status: 'processed',
                stripePaymentIntentId: 'pi_123',
                effect: 'confetti',
                duration: 1000,
                platformFee: 1,
                performerEarnings: 11
              }
            ],
            totalCount: 1
          }
        })
      }
      if (url.includes('/api/admin/tips/tip-1/refund')) {
        return Promise.resolve({ data: { success: true, refundId: 're_123' } })
      }
      return Promise.resolve({ data: {} })
    })
  })

  it('shows refund button and triggers refund request', async () => {
    render(<AdminDashboard />)

    const refundButton = await screen.findByRole('button', { name: /refund/i })
    expect(refundButton).toBeInTheDocument()

    await userEvent.click(refundButton)
    const confirmButton = await screen.findByRole('button', { name: /^refund$/i })
    await userEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockApiService.post).toHaveBeenCalledWith('/api/admin/tips/tip-1/refund')
    })
  })
})
