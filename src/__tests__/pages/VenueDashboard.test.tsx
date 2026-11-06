import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import VenueDashboard from '@/pages/VenueDashboard'

const venueApi = vi.hoisted(() => ({ me: vi.fn(), devices: vi.fn(), links: vi.fn(), requests: vi.fn(), history: vi.fn() }))
vi.mock('@/services/venueApi', () => ({ venueApi }))
vi.mock('@/theme/ThemeContext', () => ({
  usePortalTheme: () => ({ dark: false, className: '' }),
  useTheme: () => ({ preference: 'light', resolved: 'light', setPreference: vi.fn(), inPortal: true })
}))

const pendingVenue = {
  id: 'v1', businessName: 'The Flying J', firstName: 'Val', lastName: 'Owner', email: 'val@x.test', phone: '5125550100',
  addressLine1: '1 Main St', city: 'Austin', state: 'TX', postalCode: '78701', hasLocation: false, status: 'pending', timeZoneId: 'America/Chicago'
}

const renderPage = () => render(<MemoryRouter initialEntries={['/venue']}><VenueDashboard /></MemoryRouter>)

describe('venue portal first load', () => {
  beforeEach(() => {
    Object.values(venueApi).forEach(f => f.mockReset())
    venueApi.me.mockResolvedValue({ data: pendingVenue, status: 200 })
    venueApi.devices.mockResolvedValue({ data: [{ deviceId: 'd1', name: 'Main stage', serialNumber: 'TPY-1', isPaused: false, isSoundEnabled: false, soundId: 1, soundVolume: 'low', isRandomLightEffect: false, current: null, pendingRequests: 0, upcomingSessions: 0 }] })
    venueApi.links.mockResolvedValue({ data: [] })
    venueApi.requests.mockResolvedValue({ data: [] })
    venueApi.history.mockResolvedValue({ data: { items: [], total: 0 } })
  })

  it('shows a brand-new, unapproved venue its home page, never a blank screen', async () => {
    renderPage()
    expect(await screen.findByText('Waiting for Tipwave approval')).toBeInTheDocument()
    expect(screen.getByText('Main stage')).toBeInTheDocument()
  })

  it('copes with empty or odd answers from the server', async () => {
    venueApi.devices.mockResolvedValue({ data: null })
    venueApi.links.mockResolvedValue({ error: 'x' })
    venueApi.requests.mockResolvedValue({})
    renderPage()
    expect(await screen.findByText('Waiting for Tipwave approval')).toBeInTheDocument()
  })

  it('says venues are not available when the server does not know the feature', async () => {
    venueApi.me.mockResolvedValue({ status: 404, error: 'Not available' })
    renderPage()
    expect(await screen.findByText('Venue accounts are not available yet')).toBeInTheDocument()
  })

  it('moves through its tabs without breaking', async () => {
    renderPage()
    await screen.findByText('Waiting for Tipwave approval')
    for (const name of ['Performers', 'Devices', 'History']) {
      fireEvent.click(screen.getAllByRole('button', { name })[0])
      await waitFor(() => expect(screen.getAllByText(name).length).toBeGreaterThan(0))
    }
  })
})
