import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AlertsCard from '@/components/portal/AlertsCard'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))
const push = vi.hoisted(() => ({
  getPushSupport: vi.fn(() => 'ready'),
  loadPushConfig: vi.fn(async () => ({ enabled: true, publicKey: 'k' })),
  notificationPermission: vi.fn(() => 'default'),
  currentSubscription: vi.fn(async () => null),
  enablePushAlerts: vi.fn(async () => 'on'),
  disablePushAlerts: vi.fn(async () => undefined),
  sendTestAlert: vi.fn(async () => 1),
  getEnableFailure: vi.fn(() => '')
}))
vi.mock('@/utils/pushAlerts', () => push)

const amounts = [2, 5, 10, 20, 50, 100]

describe('AlertsCard', () => {
  beforeEach(() => {
    Object.values(push).forEach(f => f.mockClear())
    push.getPushSupport.mockReturnValue('ready')
    push.notificationPermission.mockReturnValue('default')
    push.currentSubscription.mockResolvedValue(null)
    api.get.mockResolvedValue({ data: { amounts: [20] } })
    api.put.mockImplementation(async (_u: string, body: { amounts: number[] }) => ({ data: { amounts: body.amounts } }))
  })

  it('shows the saved amounts as pressed and saves a change', async () => {
    render(<AlertsCard tipAmounts={amounts} />)
    const twenty = await screen.findByRole('button', { name: '$20' })
    await waitFor(() => expect(twenty).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('button', { name: '$50' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: '$100' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/profiles/me/alert-amounts', { amounts: [20, 100] }))
    await waitFor(() => expect(screen.getByRole('button', { name: '$100' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('marks the chosen amounts with a check, so on and off cannot be confused', async () => {
    render(<AlertsCard tipAmounts={amounts} />)
    const twenty = await screen.findByRole('button', { name: '$20' })
    await waitFor(() => expect(twenty).toHaveAttribute('aria-pressed', 'true'))
    expect(twenty.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: '$50' }).querySelector('svg')).toBeNull()
  })

  it('puts the amount back and says so when saving fails', async () => {
    api.put.mockResolvedValue({ error: 'nope' })
    render(<AlertsCard tipAmounts={amounts} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '$20' })).toHaveAttribute('aria-pressed', 'true'))

    fireEvent.click(screen.getByRole('button', { name: '$50' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByRole('button', { name: '$50' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('turns alerts on from a tap and then offers a test', async () => {
    push.enablePushAlerts.mockImplementation(async () => {
      push.currentSubscription.mockResolvedValue({ endpoint: 'e' } as any)
      push.notificationPermission.mockReturnValue('granted')
      return 'on'
    })
    render(<AlertsCard tipAmounts={amounts} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on tip alerts' }))

    expect(await screen.findByText('On for this device')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send me a test' }))
    await waitFor(() => expect(push.sendTestAlert).toHaveBeenCalled())
    expect(await screen.findByText(/A banner should appear/)).toBeInTheDocument()
  })

  it('tells iPad users to add Tipwave to the Home Screen, with no button to press', async () => {
    push.getPushSupport.mockReturnValue('needs-install')
    render(<AlertsCard tipAmounts={amounts} />)
    expect(await screen.findByText('Add Tipwave to your Home Screen first')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn on tip alerts' })).toBeNull()
  })

  it('explains blocked notifications', async () => {
    push.notificationPermission.mockReturnValue('denied')
    render(<AlertsCard tipAmounts={amounts} />)
    expect(await screen.findByText('Notifications are blocked for Tipwave')).toBeInTheDocument()
  })

  it('says alerts are not switched on when the server has no keys', async () => {
    push.loadPushConfig.mockResolvedValueOnce({ enabled: false } as any)
    render(<AlertsCard tipAmounts={amounts} />)
    expect(await screen.findByText('Tip alerts are not switched on yet')).toBeInTheDocument()
  })

  it('shows every tip in the Live queue by default, and can limit it to the chosen amounts', async () => {
    api.get.mockResolvedValue({ data: { amounts: [20], showAllTips: true } })
    api.put.mockImplementation(async (_u: string, body: { amounts: number[]; showAllTips?: boolean }) => ({ data: { amounts: body.amounts, showAllTips: body.showAllTips ?? true } }))
    render(<AlertsCard tipAmounts={amounts} />)

    const toggle = await screen.findByRole('switch', { name: 'Show every tip in my Live queue' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/profiles/me/alert-amounts', { amounts: [20], showAllTips: false }))
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  })
})
