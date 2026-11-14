import React from 'react'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminDashboard from '@/pages/AdminDashboard'

// vi.mock is hoisted above the file's other code, so the mocks it uses have to be created with vi.hoisted
const { mockNavigate, mockApiService } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockApiService: { getProfile: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn() }
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('@/services/api', () => ({
  apiService: mockApiService,
  default: mockApiService
}))

// Clicks use fireEvent, not userEvent: userEvent inspects the style of every parent before each click, which is very slow on this big page
vi.setConfig({ testTimeout: 60000 })

// The table library asks for the style of pseudo-elements, which the test browser cannot compute: each ask logs a long error and is slow.
// Answering without the pseudo-element is what it needs.
const realGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = ((element: Element) => realGetComputedStyle(element)) as typeof window.getComputedStyle

describe('AdminDashboard refund flow', () => {
  beforeEach(() => {
    // each test starts with a clean record of what was called
    Object.values(mockApiService).forEach(f => f.mockReset())
    // the test setup replaces localStorage with a stub, so the token has to be answered by getItem
    localStorage.getItem = vi.fn((key: string) => (key === 'token' ? 'test-token' : null))
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

  const goToTips = async () => {
    render(<AdminDashboard />)
    // the page opens on Overview; the refund button is on the Tips tab, reached from the main navigation
    // (there is a side menu and a bottom bar; either one works)
    const navs = await screen.findAllByRole('navigation', { name: 'Main' })
    fireEvent.click(within(navs[0]).getByRole('button', { name: /Tips/ }))
  }

  it('shows the refund button on a recent charged tip, asks first, lets the admin keep the tip, and only refunds on confirm', async () => {
    await goToTips()

    const tableRefund = await screen.findByRole('button', { name: 'Refund' })
    fireEvent.click(tableRefund)

    // a question first: nothing is refunded by the first click
    expect(await screen.findByText('Refund this tip?')).toBeInTheDocument()
    expect(mockApiService.post).not.toHaveBeenCalledWith('/api/admin/tips/tip-1/refund')

    // "Keep tip" closes the question and refunds nothing
    fireEvent.click(await screen.findByRole('button', { name: 'Keep tip' }))
    await waitFor(() => expect(screen.queryByText('Refund this tip?')).toBeNull())
    expect(mockApiService.post).not.toHaveBeenCalledWith('/api/admin/tips/tip-1/refund')

    // asked again, and this time confirmed: exactly one refund
    fireEvent.click(await screen.findByRole('button', { name: 'Refund' }))
    await screen.findByText('Refund this tip?')
    const buttons = await screen.findAllByRole('button', { name: 'Refund' })
    fireEvent.click(buttons[buttons.length - 1]) // the confirm button in the question

    await waitFor(() => {
      expect(mockApiService.post).toHaveBeenCalledWith('/api/admin/tips/tip-1/refund')
    })
    expect(mockApiService.post.mock.calls.filter(([u]: [string]) => u.includes('/refund'))).toHaveLength(1)
  })

  it('offers no refund on a tip that is old, not charged, or has no payment to refund', async () => {
    const day = 24 * 3600 * 1000
    const tip = (id: string, over: Record<string, unknown>) => ({
      id, createdAt: new Date().toISOString(), amount: 12, deviceNickname: 'Stage', performerFirstName: 'Jane', performerLastName: 'Doe',
      performerEmail: 'jane@example.com', status: 'processed', stripePaymentIntentId: 'pi_123', effect: 'x', duration: 1000, platformFee: 1, performerEarnings: 11, ...over
    })
    mockApiService.post.mockImplementation((url: string) =>
      Promise.resolve(url.includes('/api/admin/tips/search')
        ? { data: { tips: [
            tip('old', { createdAt: new Date(Date.now() - 8 * day).toISOString() }),
            tip('pending', { status: 'pending' }),
            tip('failed', { status: 'failed' }),
            tip('nopay', { stripePaymentIntentId: null })
          ], totalCount: 4 } }
        : { data: {} }))

    await goToTips()

    await waitFor(() => expect(mockApiService.post).toHaveBeenCalledWith('/api/admin/tips/search', expect.anything()))
    await new Promise(r => setTimeout(r, 200))
    expect(screen.queryByRole('button', { name: 'Refund' })).toBeNull()
  })
})
