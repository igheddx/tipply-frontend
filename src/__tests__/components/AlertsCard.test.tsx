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

describe('AlertsCard', () => {
  beforeEach(() => {
    Object.values(push).forEach(f => f.mockClear())
    push.getPushSupport.mockReturnValue('ready')
    push.notificationPermission.mockReturnValue('default')
    push.currentSubscription.mockResolvedValue(null)
    api.get.mockResolvedValue({ data: { songsOnly: false } })
    api.put.mockImplementation(async (_u: string, body: { songsOnly: boolean }) => ({ data: { songsOnly: body.songsOnly } }))
  })

  it('alerts on every tip by default: there are no amounts to choose, and "songs only" is off', async () => {
    render(<AlertsCard />)
    const toggle = await screen.findByRole('switch', { name: 'Only alert me for tips with a song' })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    expect(screen.queryByRole('button', { name: '$20' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Show every tip in my Live queue' })).toBeNull()
    expect(screen.getByText(/Every tip shows on your Live tab, and every tip sends an alert/)).toBeInTheDocument()
  })

  it('saves "songs only" and shows it as on', async () => {
    render(<AlertsCard />)
    const toggle = await screen.findByRole('switch', { name: 'Only alert me for tips with a song' })
    await waitFor(() => expect(toggle).not.toBeDisabled())
    fireEvent.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/profiles/me/alert-preference', { songsOnly: true }))
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
  })

  it('shows a saved "songs only" choice as on when it opens', async () => {
    api.get.mockResolvedValue({ data: { songsOnly: true } })
    render(<AlertsCard />)
    const toggle = await screen.findByRole('switch', { name: 'Only alert me for tips with a song' })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
  })

  it('puts the switch back and says so when saving fails', async () => {
    api.put.mockResolvedValue({ error: 'nope' })
    render(<AlertsCard />)
    const toggle = await screen.findByRole('switch', { name: 'Only alert me for tips with a song' })
    await waitFor(() => expect(toggle).not.toBeDisabled())

    fireEvent.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('turns alerts on from a tap and then offers a test', async () => {
    push.enablePushAlerts.mockImplementation(async () => {
      push.currentSubscription.mockResolvedValue({ endpoint: 'e' } as any)
      push.notificationPermission.mockReturnValue('granted')
      return 'on'
    })
    render(<AlertsCard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on tip alerts' }))

    expect(await screen.findByText('On for this device')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send me a test' }))
    await waitFor(() => expect(push.sendTestAlert).toHaveBeenCalled())
    expect(await screen.findByText(/A banner should appear/)).toBeInTheDocument()
  })

  it('tells iPad users to add Tipwave to the Home Screen, with no button to press', async () => {
    push.getPushSupport.mockReturnValue('needs-install')
    render(<AlertsCard />)
    expect(await screen.findByText('Add Tipwave to your Home Screen first')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn on tip alerts' })).toBeNull()
  })

  it('explains blocked notifications', async () => {
    push.notificationPermission.mockReturnValue('denied')
    render(<AlertsCard />)
    expect(await screen.findByText('Notifications are blocked for Tipwave')).toBeInTheDocument()
  })

  it('says alerts are not switched on when the server has no keys', async () => {
    push.loadPushConfig.mockResolvedValueOnce({ enabled: false } as any)
    render(<AlertsCard />)
    expect(await screen.findByText('Tip alerts are not switched on yet')).toBeInTheDocument()
  })
})
