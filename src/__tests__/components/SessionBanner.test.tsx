import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SessionBanner } from '@/components/venue/SessionBanner'

const venueApi = vi.hoisted(() => ({ currentSession: vi.fn(), extendMine: vi.fn(), endMine: vi.fn() }))
vi.mock('@/services/venueApi', () => ({ venueApi }))
const feedback = vi.hoisted(() => ({ toast: vi.fn(), confirm: vi.fn(async () => true) }))
vi.mock('@/components/ui/Feedback', () => ({ useFeedback: () => feedback, FeedbackProvider: ({ children }: any) => children }))

const minutes = (m: number) => new Date(Date.now() + m * 60000).toISOString()
const session = (endsInMin: number) => ({
  id: 's1', deviceId: 'd1', deviceName: 'Main stage', venueId: 'v1', venueName: 'Flying J',
  performer: { id: 'p1', displayName: 'Annie' }, status: 'approved', state: 'active',
  startsAt: minutes(endsInMin - 240), endsAt: minutes(endsInMin), graceEndsAt: minutes(endsInMin + 60),
  requestedBy: 'performer', tipCount: 0, allowSongRequests: true, createdAt: minutes(-300)
})

describe('SessionBanner', () => {
  beforeEach(() => {
    venueApi.currentSession.mockReset()
    venueApi.extendMine.mockReset().mockResolvedValue({ data: {} })
    venueApi.endMine.mockReset().mockResolvedValue({ data: {} })
    feedback.toast.mockClear()
    feedback.confirm.mockClear().mockResolvedValue(true)
  })

  it('shows nothing when the performer is not on a venue device', async () => {
    venueApi.currentSession.mockResolvedValue({ data: { session: null } })
    const { container } = render(<SessionBanner />)
    await waitFor(() => expect(venueApi.currentSession).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('is calm while the session has plenty of time', async () => {
    venueApi.currentSession.mockResolvedValue({ data: { session: session(120) } })
    render(<SessionBanner />)

    expect(await screen.findByText('You are on Main stage at Flying J')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add an hour' })).toBeNull()
    expect(screen.getByRole('button', { name: 'End session' })).toBeInTheDocument()
  })

  it('gives a heads-up in the last half hour, with a way to add time', async () => {
    venueApi.currentSession.mockResolvedValue({ data: { session: session(20) } })
    render(<SessionBanner />)

    expect(await screen.findByText(/Your session ends in 2\d min|Your session ends in 20 min|Your session ends in 19 min/)).toBeInTheDocument()
    expect(screen.getByText(/one more hour before the device disconnects/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add an hour' }))
    await waitFor(() => expect(venueApi.extendMine).toHaveBeenCalledWith('s1'))
  })

  it('warns clearly once the grace hour has started, and says when the device disconnects', async () => {
    venueApi.currentSession.mockResolvedValue({ data: { session: session(-10) } })
    render(<SessionBanner />)

    expect(await screen.findByText(/Your time on Main stage is up\. It disconnects in/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add an hour' })).toBeInTheDocument()
  })

  it('hides itself once even the grace hour is over', async () => {
    venueApi.currentSession.mockResolvedValue({ data: { session: session(-90) } })
    const { container } = render(<SessionBanner />)
    await waitFor(() => expect(venueApi.currentSession).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('asks before ending the session', async () => {
    venueApi.currentSession.mockResolvedValue({ data: { session: session(120) } })
    render(<SessionBanner />)
    fireEvent.click(await screen.findByRole('button', { name: 'End session' }))

    await waitFor(() => expect(venueApi.endMine).toHaveBeenCalledWith('s1'))
    expect(feedback.confirm).toHaveBeenCalled()
  })

  it('does not end it when the performer says no', async () => {
    feedback.confirm.mockResolvedValue(false)
    venueApi.currentSession.mockResolvedValue({ data: { session: session(120) } })
    render(<SessionBanner />)
    fireEvent.click(await screen.findByRole('button', { name: 'End session' }))

    await waitFor(() => expect(feedback.confirm).toHaveBeenCalled())
    expect(venueApi.endMine).not.toHaveBeenCalled()
  })
})
