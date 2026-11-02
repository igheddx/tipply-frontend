import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { VenueSection } from '@/components/venue/VenueSection'

const venueApi = vi.hoisted(() => ({ myVenues: vi.fn(), startMine: vi.fn(), endMine: vi.fn(), leave: vi.fn() }))
vi.mock('@/services/venueApi', () => ({ venueApi }))
const feedback = vi.hoisted(() => ({ toast: vi.fn(), confirm: vi.fn(async () => true) }))
vi.mock('@/components/ui/Feedback', () => ({ useFeedback: () => feedback, FeedbackProvider: ({ children }: any) => children }))
vi.mock('@/utils/venueCard', () => ({ downloadPerformerVenueCard: vi.fn(async () => undefined) }))

const venue = (trust: 'self' | 'approval', devices: any[]) => [
  { venue: { id: 'v1', name: 'Flying J', status: 'approved', city: 'Austin', state: 'TX', timeZoneId: 'America/Chicago' }, linkId: 'l1', trustLevel: trust, devices }
]
const device = (over: Record<string, unknown> = {}) => ({ deviceId: 'd1', name: 'Main stage', availability: 'available', ...over })

describe('At venues', () => {
  beforeEach(() => {
    Object.values(venueApi).forEach(f => f.mockReset())
    venueApi.startMine.mockResolvedValue({ data: { session: {}, needsApproval: false } })
    venueApi.endMine.mockResolvedValue({ data: {} })
    venueApi.leave.mockResolvedValue({ data: {} })
    feedback.toast.mockClear()
    feedback.confirm.mockClear().mockResolvedValue(true)
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 30.1, longitude: -97.2, accuracy: 25 }, timestamp: Date.now() }) }
    })
  })

  it('shows nothing for a performer with no venues', async () => {
    venueApi.myVenues.mockResolvedValue({ data: [] })
    const { container } = render(<VenueSection />)
    await waitFor(() => expect(venueApi.myVenues).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('labels the venue and each device\'s availability, so it is clear whose device it is', async () => {
    venueApi.myVenues.mockResolvedValue({ data: venue('self', [device(), device({ deviceId: 'd2', name: 'Patio', availability: 'in_use', busyUntil: new Date(Date.now() + 3600000).toISOString() })]) })
    render(<VenueSection performerId="p1" stageName="Annie" />)

    expect(await screen.findByText('Flying J')).toBeInTheDocument()
    expect(screen.getByText('Venue device')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getAllByText('In use')).toHaveLength(2) // the status and the disabled button
    expect(screen.getByRole('button', { name: 'In use' })).toBeDisabled()
  })

  it('a trusted performer sends their location when starting now', async () => {
    venueApi.myVenues.mockResolvedValue({ data: venue('self', [device()]) })
    render(<VenueSection performerId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Use this device' }))
    expect(screen.getByText(/ask for your location/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start now' }))

    await waitFor(() => expect(venueApi.startMine).toHaveBeenCalled())
    expect(venueApi.startMine).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'd1', latitude: 30.1, longitude: -97.2, accuracyMeters: 25, allowSongRequests: true, positionAt: expect.stringMatching(/Z$/) }))
  })

  it('a performer who needs approval says so, and sends no location', async () => {
    venueApi.myVenues.mockResolvedValue({ data: venue('approval', [device()]) })
    venueApi.startMine.mockResolvedValue({ data: { needsApproval: true, notice: 'This venue approves each session.' } })
    render(<VenueSection performerId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Use this device' }))
    expect(screen.getByText(/approves this before it starts/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ask to start now' }))

    await waitFor(() => expect(venueApi.startMine).toHaveBeenCalled())
    expect(venueApi.startMine.mock.calls[0][0].latitude).toBeUndefined()
    await waitFor(() => expect(feedback.toast).toHaveBeenCalledWith('This venue approves each session.', 'success'))
  })

  it('can ask for a booked time', async () => {
    venueApi.myVenues.mockResolvedValue({ data: venue('self', [device()]) })
    render(<VenueSection performerId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Use this device' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Choose a different time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Request this time' }))

    await waitFor(() => expect(venueApi.startMine).toHaveBeenCalled())
    const body = venueApi.startMine.mock.calls[0][0]
    expect(body.startsAt).toMatch(/Z$/)
    expect(body.endsAt).toMatch(/Z$/)
    expect(body.latitude).toBeUndefined()
  })

  it('shows an error from the server, such as the device being busy', async () => {
    venueApi.myVenues.mockResolvedValue({ data: venue('self', [device()]) })
    venueApi.startMine.mockResolvedValue({ error: 'This device is being used right now.', status: 409 })
    render(<VenueSection performerId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Use this device' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start now' }))

    await waitFor(() => expect(feedback.toast).toHaveBeenCalledWith('This device is being used right now.', 'error'))
  })

  it('lets a performer end their own session and shows their request waiting', async () => {
    const mine = { id: 's9', endsAt: new Date(Date.now() + 3600000).toISOString(), startsAt: new Date().toISOString() }
    venueApi.myVenues.mockResolvedValue({ data: venue('approval', [device({ availability: 'in_use_by_you', mine }), device({ deviceId: 'd2', name: 'Patio', availability: 'requested_by_you', mine: { ...mine, id: 's10' } })]) })
    render(<VenueSection performerId="p1" />)

    expect(await screen.findByText('You are on')).toBeInTheDocument()
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'End session' }))
    await waitFor(() => expect(venueApi.endMine).toHaveBeenCalledWith('s9'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(venueApi.endMine).toHaveBeenCalledWith('s10'))
  })

  it('offers their own printable card, and leaving the venue', async () => {
    const card = await import('@/utils/venueCard')
    venueApi.myVenues.mockResolvedValue({ data: venue('self', [device()]) })
    render(<VenueSection performerId="p1" stageName="Annie" />)

    fireEvent.click(await screen.findByRole('button', { name: 'My QR card' }))
    await waitFor(() => expect(card.downloadPerformerVenueCard).toHaveBeenCalledWith('d1', 'Main stage', 'p1', 'Annie'))

    fireEvent.click(screen.getByRole('button', { name: 'Leave this venue' }))
    await waitFor(() => expect(venueApi.leave).toHaveBeenCalledWith('l1'))
  })
})
