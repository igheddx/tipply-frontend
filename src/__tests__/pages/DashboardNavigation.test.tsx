import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// The performer's dashboard is a big page, drawn in a simulated browser: stub the calls it makes at start-up, and keep the style lookup
// the table library needs answerable (see AdminDashboardRefund.test for why)
const { navigate, api } = vi.hoisted(() => {
  const ok = (data: unknown) => vi.fn(async () => ({ data }))
  return {
    navigate: vi.fn(),
    api: {
      getProfile: ok({ id: 'p1', firstName: 'Dave', lastName: 'L', stageName: 'Dave Lovett Piano', role: 'user', accountType: 'performer', tipAmounts: [5, 10, 15, 20, 50, 100] }),
      getDemoMode: ok({ demoMode: false }),
      getDashboardStats: vi.fn(),
      getDashboardMetrics: ok({ totalEarnings: 0, pendingPayouts: 0, pendingTips: 0, todaysTips: 0, stripeAvailableBalance: 0, stripeFuturePayouts: 0, stripeInTransit: 0, stripeLifetimeVolume: 0, stripeReadyToPayOut: 0 }),
      getRecentTips: ok([]),
      getTipHistory: ok({ items: [], total: 0, summary: null }),
      getDevices: ok([]),
      getDeletedDevices: ok([]),
      getConnectAccountStatus: ok(null),
      get: ok(null),
      put: ok(null),
      post: ok(null),
      delete: ok(null)
    }
  }
})

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))
vi.mock('@/services/showApi', () => ({ showApi: { enabled: async () => false, list: async () => ({ data: { shows: [], total: 0 } }), current: async () => ({ data: null }) } }))
vi.mock('@/services/venueApi', () => ({ venueApi: { features: async () => ({ data: { venues: false } }), invitations: async () => ({ data: [] }), performerVenues: async () => ({ data: [] }), invites: async () => ({ data: [] }), currentSession: async () => ({ data: null }), myVenues: async () => ({ data: [] }) } }))
// The Live screen has its own tests; here it only has to be found
vi.mock('@/components/SongRequestMonitor', () => ({
  default: ({ isVisible, onClose }: any) => (isVisible ? <div role="dialog" aria-label="Live screen"><button onClick={onClose}>Close Live</button></div> : null)
}))
vi.mock('@/components/portal/AlertsPrompt', () => ({ default: () => <div>alerts offer</div> }))
vi.mock('@/components/portal/AlertsCard', () => ({ default: () => <div>alerts settings</div> }))

const realGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = ((element: Element) => realGetComputedStyle(element)) as typeof window.getComputedStyle

import Dashboard from '@/pages/Dashboard'

vi.setConfig({ testTimeout: 60000 })

const device = (over: Record<string, unknown> = {}) => ({
  id: 'd1', uuid: 'u1', serialNumber: 'SN1', nickname: 'Stage', isOnline: true, totalTipsReceived: 0, totalTipsCount: 0, lastTipReceived: new Date().toISOString(),
  qrCodeUrl: 'https://x/tip/d1', isAllowSongRequest: false, askForSongFirst: false, isSoundEnabled: false, isRandomLightEffect: false, soundId: 1, soundVolume: 'low', isPaused: false,
  effectConfiguration: '{"5":"effect1","10":"effect2","15":"effect3","20":"effect4","50":"effect5","100":"effect6"}', ...over
})

const stats = (devices: unknown[]) => ({
  totalDevices: devices.length, activeDevices: devices.length, totalTipsReceived: 0, totalTipsCount: 0, todayTipsReceived: 0, todayTipsCount: 0,
  thisWeekTipsReceived: 0, thisWeekTipsCount: 0, thisMonthTipsReceived: 0, thisMonthTipsCount: 0, devices, recentTips: []
})

const mainNav = async () => (await screen.findAllByRole('navigation', { name: 'Main' }))[0]

beforeEach(() => {
  navigate.mockReset()
  api.getDashboardStats.mockReset()
  api.getDashboardStats.mockResolvedValue({ data: stats([device()]) })
  localStorage.getItem = vi.fn((k: string) => (k === 'token' ? 'test-token' : null))
  window.history.replaceState({}, '', '/dashboard')
  window.scrollTo = vi.fn() as any
  global.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '', headers: new Headers() })) as any
})

describe('the performer dashboard, Live', () => {
  it('has a Live tab for a performer who does not take song requests, since Live shows every tip', async () => {
    api.getDashboardStats.mockResolvedValue({ data: stats([device({ isAllowSongRequest: false })]) })
    render(<Dashboard />)

    const nav = await mainNav()
    expect(within(nav).getByRole('button', { name: /Live/ })).toBeInTheDocument()
  })

  it('opens the Live screen itself when the tab is tapped, not a page of buttons, and closing it returns to where they were', async () => {
    render(<Dashboard />)
    const nav = await mainNav()

    fireEvent.click(within(nav).getByRole('button', { name: /Live/ }))

    expect(await screen.findByRole('dialog', { name: 'Live screen' })).toBeInTheDocument()
    expect(screen.queryByText('Open full-screen view')).toBeNull() // the old launch page is gone
    fireEvent.click(screen.getByRole('button', { name: 'Close Live' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Live screen' })).toBeNull())
  })

  it('opens the Live screen straight away from the link in a tip alert (/dashboard?tab=monitor)', async () => {
    window.history.replaceState({}, '', '/dashboard?tab=monitor')
    render(<Dashboard />)

    expect(await screen.findByRole('dialog', { name: 'Live screen' })).toBeInTheDocument()
  })

  it('offers tip alerts on Home, and keeps the full alert settings on the Devices page', async () => {
    render(<Dashboard />)
    const nav = await mainNav()

    expect(await screen.findByText('alerts offer')).toBeInTheDocument() // Home
    expect(screen.queryByText('alerts settings')).toBeNull()

    fireEvent.click(within(nav).getByRole('button', { name: /Devices/ }))
    expect(await screen.findByText('alerts settings')).toBeInTheDocument()
  })
})

describe('the performer dashboard, Devices', () => {
  const openDevices = async () => {
    render(<Dashboard />)
    const nav = await mainNav()
    fireEvent.click(within(nav).getByRole('button', { name: /Devices/ }))
  }

  it('has one place for the tip buttons: the six amounts with the light for each, and no second list of lights on the device', async () => {
    await openDevices()

    const six = await screen.findByRole('list', { name: 'Tip buttons, left to right' })
    expect(within(six).getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByLabelText('Light for the $20 button')).toHaveValue('effect4')
    // the old per-device list of lights is gone
    expect(screen.queryByText('Light effect for each tip amount')).toBeNull()
  })

  it('keeps sound, tone, volume, random light and the tip page link under "Advanced", closed until asked for', async () => {
    await openDevices()

    const fold = await screen.findByRole('button', { name: /Advanced/ })
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Random light effect')).toBeNull()
    // by default a device shows only: status, QR code, pause and song requests
    expect(screen.getByRole('button', { name: /Download QR code/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument()
    expect(screen.getByText('Song requests')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open tip page' })).toBeNull()

    fireEvent.click(fold)
    expect(await screen.findByText('Random light effect')).toBeInTheDocument()
    expect(screen.getByText('Tone')).toBeInTheDocument()
    expect(screen.getByText('Volume')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open tip page' })).toBeInTheDocument()
  })

  it('shows "ask when an amount is tapped" only under a device that takes song requests', async () => {
    api.getDashboardStats.mockResolvedValue({ data: stats([device({ isAllowSongRequest: false })]) })
    await openDevices()
    await screen.findByText('Your six tip buttons')
    expect(screen.queryByRole('switch', { name: 'Ask when an amount is tapped' })).toBeNull()
  })

  it('shows it when the device takes song requests', async () => {
    api.getDashboardStats.mockResolvedValue({ data: stats([device({ isAllowSongRequest: true })]) })
    await openDevices()
    expect(await screen.findByRole('switch', { name: 'Ask when an amount is tapped' })).toBeInTheDocument()
  })
})

describe('the performer dashboard, Tips', () => {
  it('opens on Shows when shows are switched on, with the list of every tip one tap away', async () => {
    const showApi = (await import('@/services/showApi')).showApi as any
    showApi.enabled = async () => true
    render(<Dashboard />)
    const nav = await mainNav()

    fireEvent.click(within(nav).getByRole('button', { name: /^Tips/ }))

    const tabs = await screen.findAllByRole('tab')
    const names = tabs.map(t => t.textContent)
    expect(names).toContain('Shows')
    expect(names).toContain('All tips')
    expect(names.indexOf('Shows')).toBeLessThan(names.indexOf('All tips')) // Shows first
    expect(screen.getByRole('tab', { name: 'Shows' })).toHaveAttribute('aria-selected', 'true')
    showApi.enabled = async () => false
  })

  it('has no Shows tab when shows are off, and goes straight to the tips', async () => {
    render(<Dashboard />)
    const nav = await mainNav()

    fireEvent.click(within(nav).getByRole('button', { name: /^Tips/ }))
    await screen.findByText('Every tip, before and after fees.') // the Tips page is showing
    expect(screen.queryByRole('tab', { name: 'Shows' })).toBeNull()
  })
})
