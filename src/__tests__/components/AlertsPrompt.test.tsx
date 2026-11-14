import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AlertsPrompt from '@/components/portal/AlertsPrompt'

const push = vi.hoisted(() => ({
  getPushSupport: vi.fn(() => 'ready'),
  loadPushConfig: vi.fn(async () => ({ enabled: true, publicKey: 'k' })),
  notificationPermission: vi.fn(() => 'default'),
  currentSubscription: vi.fn(async () => null),
  enablePushAlerts: vi.fn(async () => 'on'),
  getEnableFailure: vi.fn(() => '')
}))
vi.mock('@/utils/pushAlerts', () => push)

const stored: Record<string, string> = {}

beforeEach(() => {
  Object.values(push).forEach(f => f.mockClear())
  push.getPushSupport.mockReturnValue('ready')
  push.loadPushConfig.mockResolvedValue({ enabled: true, publicKey: 'k' })
  push.notificationPermission.mockReturnValue('default')
  push.currentSubscription.mockResolvedValue(null)
  push.enablePushAlerts.mockResolvedValue('on')
  Object.keys(stored).forEach(k => delete stored[k])
  localStorage.getItem = vi.fn((k: string) => stored[k] ?? null)
  localStorage.setItem = vi.fn((k: string, v: string) => { stored[k] = v })
})

const nothingShown = async () => {
  await new Promise(r => setTimeout(r, 100))
  expect(screen.queryByText('Get a banner when a tip arrives')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Turn on tip alerts' })).toBeNull()
}

describe('AlertsPrompt, who is offered it', () => {
  it('offers to turn alerts on when this device can and has not', async () => {
    render(<AlertsPrompt />)
    expect(await screen.findByText('Get a banner when a tip arrives')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn on tip alerts' })).toBeInTheDocument()
  })

  it('says nothing on a browser that cannot receive alerts', async () => {
    push.getPushSupport.mockReturnValue('unsupported')
    render(<AlertsPrompt />)
    await nothingShown()
  })

  it('says nothing when alerts are not switched on at the server', async () => {
    push.loadPushConfig.mockResolvedValue({ enabled: false } as any)
    render(<AlertsPrompt />)
    await nothingShown()
  })

  it('says nothing when alerts are already on for this device', async () => {
    push.currentSubscription.mockResolvedValue({ endpoint: 'e' } as any)
    render(<AlertsPrompt />)
    await nothingShown()
  })

  it('says nothing when the person already allowed or blocked notifications (the Devices page explains)', async () => {
    for (const permission of ['granted', 'denied']) {
      push.notificationPermission.mockReturnValue(permission)
      const { unmount } = render(<AlertsPrompt />)
      await nothingShown()
      unmount()
    }
  })

  it('says nothing to someone who already said "Not now"', async () => {
    stored.tipwave_alerts_prompt_dismissed = '1'
    render(<AlertsPrompt />)
    await nothingShown()
  })
})

describe('AlertsPrompt, what happens when they answer', () => {
  it('turns alerts on from one tap, says so, and goes away', async () => {
    render(<AlertsPrompt />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on tip alerts' }))

    expect(await screen.findByText(/Tip alerts are on for this device/)).toBeInTheDocument()
    expect(push.enablePushAlerts).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Turn on tip alerts' })).toBeNull()
  })

  it('explains when the phone did not allow notifications, and does not keep asking', async () => {
    push.enablePushAlerts.mockResolvedValue('denied')
    render(<AlertsPrompt />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on tip alerts' }))

    expect(await screen.findByText(/Notifications were not allowed/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn on tip alerts' })).toBeNull()
  })

  it('keeps the offer and says what went wrong when turning on fails, so it can be tried again', async () => {
    push.enablePushAlerts.mockResolvedValue('failed')
    push.getEnableFailure.mockReturnValue('(network)')
    render(<AlertsPrompt />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on tip alerts' }))

    expect(await screen.findByText(/Could not turn on alerts/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn on tip alerts' })).toBeInTheDocument()
  })

  it('"Not now" hides it and remembers, so it is offered once', async () => {
    const { unmount } = render(<AlertsPrompt />)
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))

    await waitFor(() => expect(screen.queryByText('Get a banner when a tip arrives')).toBeNull())
    expect(stored.tipwave_alerts_prompt_dismissed).toBe('1')

    unmount()
    render(<AlertsPrompt />) // the next visit
    await nothingShown()
  })
})

describe('AlertsPrompt on an iPhone or iPad', () => {
  it('tells them to add Tipwave to the Home Screen, with no button that cannot work', async () => {
    push.getPushSupport.mockReturnValue('needs-install')
    render(<AlertsPrompt />)

    expect(await screen.findByText(/add Tipwave to your Home Screen first/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn on tip alerts' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
  })
})
