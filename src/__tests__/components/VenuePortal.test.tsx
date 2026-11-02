import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { VenueInvites } from '@/components/venue/VenueInvites'
import { VenuePerformers } from '@/components/venue/VenuePerformers'
import { VenueHome } from '@/components/venue/VenueHome'
import { AdminVenues } from '@/components/venue/AdminVenues'

const venueApi = vi.hoisted(() => ({
  invites: vi.fn(), respond: vi.fn(), search: vi.fn(), invite: vi.fn(), changeLink: vi.fn(), setTrust: vi.fn(),
  approve: vi.fn(), deny: vi.fn(), end: vi.fn(), adminVenues: vi.fn(), adminFeatures: vi.fn(), adminDecide: vi.fn(), adminSetVenues: vi.fn()
}))
vi.mock('@/services/venueApi', () => ({ venueApi }))
const feedback = vi.hoisted(() => ({ toast: vi.fn(), confirm: vi.fn(async () => true) }))
vi.mock('@/components/ui/Feedback', () => ({ useFeedback: () => feedback, FeedbackProvider: ({ children }: any) => children }))

const venue = (over: Record<string, unknown> = {}) => ({
  id: 'v1', businessName: 'Flying J', firstName: 'Val', lastName: 'Owner', email: 'val@x.test', hasLocation: true, status: 'approved', timeZoneId: 'America/Chicago', ...over
}) as any

beforeEach(() => {
  Object.values(venueApi).forEach(f => f.mockReset())
  feedback.toast.mockClear()
  feedback.confirm.mockClear().mockResolvedValue(true)
})

describe('performer invitations', () => {
  it('lists the venues that invited the performer, and accepting reloads', async () => {
    const onChanged = vi.fn()
    venueApi.invites.mockResolvedValueOnce({ data: [{ linkId: 'l1', venue: { id: 'v1', name: 'Flying J', city: 'Austin', state: 'TX' }, invitedAt: '2026-11-01' }] }).mockResolvedValue({ data: [] })
    venueApi.respond.mockResolvedValue({ data: {} })
    render(<VenueInvites onChanged={onChanged} />)

    expect(await screen.findByText('A venue invited you')).toBeInTheDocument()
    expect(screen.getByText('Austin, TX')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(venueApi.respond).toHaveBeenCalledWith('l1', 'accept'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('shows nothing when there are none', async () => {
    venueApi.invites.mockResolvedValue({ data: [] })
    const { container } = render(<VenueInvites />)
    await waitFor(() => expect(venueApi.invites).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the server\'s message when accepting fails (payouts not ready)', async () => {
    venueApi.invites.mockResolvedValue({ data: [{ linkId: 'l1', venue: { id: 'v1', name: 'Flying J' }, invitedAt: '2026-11-01' }] })
    venueApi.respond.mockResolvedValue({ error: 'Finish setting up payouts first, then accept.' })
    render(<VenueInvites />)
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(venueApi.respond).toHaveBeenCalledWith('l1', 'decline'))
  })
})

describe('venue performers page', () => {
  const link = (over: Record<string, unknown> = {}) => ({ id: 'l1', status: 'active', trustLevel: 'approval', performer: { id: 'p1', displayName: 'Annie' }, invitedAt: '2026-11-01', sessionCount: 2, ...over }) as any

  it('is closed for invitations until Tipwave approves the venue', () => {
    render(<VenuePerformers venue={venue({ status: 'pending' })} links={[]} onChanged={() => {}} />)
    expect(screen.getByText('Invitations open once Tipwave approves your venue')).toBeInTheDocument()
    expect(screen.getByLabelText('Search performers')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeDisabled()
  })

  it('searches as the venue types and invites from the results', async () => {
    venueApi.search.mockResolvedValue({ data: [{ id: 'p9', displayName: 'Dee D' }] })
    venueApi.invite.mockResolvedValue({ data: { ok: true } })
    const onChanged = vi.fn()
    render(<VenuePerformers venue={venue()} links={[]} onChanged={onChanged} />)

    fireEvent.change(screen.getByLabelText('Search performers'), { target: { value: 'dee' } })
    expect(await screen.findByText('Dee D')).toBeInTheDocument()
    expect(venueApi.search).toHaveBeenCalledWith('dee')
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }))
    await waitFor(() => expect(venueApi.invite).toHaveBeenCalledWith({ performerId: 'p9' }))
    await waitFor(() => expect(screen.queryByText('Dee D')).toBeNull())
  })

  it('does not search for a single letter', async () => {
    render(<VenuePerformers venue={venue()} links={[]} onChanged={() => {}} />)
    fireEvent.change(screen.getByLabelText('Search performers'), { target: { value: 'd' } })
    await new Promise(r => setTimeout(r, 400))
    expect(venueApi.search).not.toHaveBeenCalled()
  })

  it('invites someone without an account by email', async () => {
    venueApi.invite.mockResolvedValue({ data: { ok: true } })
    render(<VenuePerformers venue={venue()} links={[]} onChanged={() => {}} />)
    fireEvent.change(screen.getByLabelText(/Invite by email/), { target: { value: 'new@x.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }))
    await waitFor(() => expect(venueApi.invite).toHaveBeenCalledWith({ email: 'new@x.test' }))
  })

  it('lets the venue choose who may start without asking, and turn access off after confirming', async () => {
    venueApi.setTrust.mockResolvedValue({ data: {} })
    venueApi.changeLink.mockResolvedValue({ data: {} })
    render(<VenuePerformers venue={venue()} links={[link()]} onChanged={() => {}} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Annie can start sessions without asking' }))
    await waitFor(() => expect(venueApi.setTrust).toHaveBeenCalledWith('l1', 'self'))

    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    await waitFor(() => expect(venueApi.changeLink).toHaveBeenCalledWith('l1', 'deactivate'))
    expect(feedback.confirm).toHaveBeenCalled()
  })

  it('does not turn access off when the venue says no', async () => {
    feedback.confirm.mockResolvedValue(false)
    render(<VenuePerformers venue={venue()} links={[link()]} onChanged={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    await waitFor(() => expect(feedback.confirm).toHaveBeenCalled())
    expect(venueApi.changeLink).not.toHaveBeenCalled()
  })

  it('shows a pending email invitation with a way to cancel it', async () => {
    venueApi.changeLink.mockResolvedValue({ data: {} })
    render(<VenuePerformers venue={venue()} links={[link({ id: 'l2', status: 'invited', performer: null, inviteEmail: 'new@x.test' })]} onChanged={() => {}} />)
    expect(screen.getByText('new@x.test')).toBeInTheDocument()
    expect(screen.getByText(/Invited by email/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel invite' }))
    await waitFor(() => expect(venueApi.changeLink).toHaveBeenCalledWith('l2', 'cancel'))
  })
})

describe('venue home', () => {
  const request = { id: 's1', deviceId: 'd1', deviceName: 'Main stage', performer: { id: 'p1', displayName: 'Annie' }, startsAt: '2026-11-04T01:00:00Z', endsAt: '2026-11-04T05:00:00Z' } as any

  it('tells a pending venue it is waiting for approval', () => {
    render(<VenueHome venue={venue({ status: 'pending' })} devices={[]} requests={[]} linkedCount={0} onChanged={() => {}} onGo={() => {}} />)
    expect(screen.getByText('Waiting for Tipwave approval')).toBeInTheDocument()
  })

  it('puts requests waiting for an answer first, and approves or declines them', async () => {
    venueApi.approve.mockResolvedValue({ data: {} })
    venueApi.deny.mockResolvedValue({ data: {} })
    render(<VenueHome venue={venue()} devices={[]} requests={[request]} linkedCount={1} onChanged={() => {}} onGo={() => {}} />)

    expect(screen.getByText('1 request waiting')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(venueApi.approve).toHaveBeenCalledWith('s1'))
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(venueApi.deny).toHaveBeenCalledWith('s1'))
  })

  it('shows who is on each device with tip counts (never amounts) and can end the session', async () => {
    venueApi.end.mockResolvedValue({ data: {} })
    const current = { ...request, id: 's2', state: 'active', tipCount: 7, endsAt: new Date(Date.now() + 3600000).toISOString(), graceEndsAt: new Date(Date.now() + 7200000).toISOString() }
    render(<VenueHome venue={venue()} devices={[{ deviceId: 'd1', name: 'Main stage', isPaused: false, current, pendingRequests: 0, upcomingSessions: 0 } as any]} requests={[]} linkedCount={1} onChanged={() => {}} onGo={() => {}} />)

    expect(screen.getByText('Annie')).toBeInTheDocument()
    expect(screen.getByText(/7 tips/)).toBeInTheDocument()
    expect(screen.queryByText(/\$/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'End session' }))
    await waitFor(() => expect(venueApi.end).toHaveBeenCalledWith('s2'))
  })

  it('asks an approved venue without a location to set one', () => {
    const onGo = vi.fn()
    render(<VenueHome venue={venue({ hasLocation: false })} devices={[]} requests={[]} linkedCount={0} onChanged={() => {}} onGo={onGo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set location' }))
    expect(onGo).toHaveBeenCalledWith('profile')
  })

  it('invites the venue to find its first performer', () => {
    const onGo = vi.fn()
    render(<VenueHome venue={venue()} devices={[]} requests={[]} linkedCount={0} onChanged={() => {}} onGo={onGo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Find performers' }))
    expect(onGo).toHaveBeenCalledWith('performers')
  })
})

describe('admin venue review', () => {
  const v = (over: Record<string, unknown> = {}) => ({
    id: 'v1', businessName: 'Flying J', contactName: 'Val Owner', email: 'val@x.test', phone: '5125550100', address: '1 Main St, Austin, TX, 78701',
    status: 'pending', createdAt: '2026-11-01T00:00:00Z', deviceCount: 1, linkedPerformers: 0, sessionCount: 0, ...over
  })

  beforeEach(() => {
    venueApi.adminFeatures.mockResolvedValue({ data: { venues: true } })
    venueApi.adminDecide.mockResolvedValue({ data: {} })
  })

  it('shows waiting venues with their details and a map link, and approves with one tap', async () => {
    venueApi.adminVenues.mockResolvedValue({ data: [v(), v({ id: 'v2', businessName: 'Old Place', status: 'approved' })] })
    render(<AdminVenues />)

    expect(await screen.findByText('Flying J')).toBeInTheDocument()
    expect(screen.queryByText('Old Place')).toBeNull() // that one is on the Approved tab
    expect(screen.getByRole('link', { name: 'See on a map' })).toHaveAttribute('href', expect.stringContaining('openstreetmap.org'))
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(venueApi.adminDecide).toHaveBeenCalledWith('v1', 'approve', undefined))
  })

  it('will not reject without a reason', async () => {
    venueApi.adminVenues.mockResolvedValue({ data: [v()] })
    render(<AdminVenues />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))

    const dialog = await screen.findByRole('dialog')
    const confirmButton = within(dialog).getByRole('button', { name: 'Reject venue' })
    expect(confirmButton).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Not a real business' } })
    expect(confirmButton).not.toBeDisabled()
    fireEvent.click(confirmButton)
    await waitFor(() => expect(venueApi.adminDecide).toHaveBeenCalledWith('v1', 'reject', 'Not a real business'))
  })

  it('suspends an approved venue and reinstates a suspended one', async () => {
    venueApi.adminVenues.mockResolvedValue({ data: [v({ status: 'approved' }), v({ id: 'v3', businessName: 'Paused Bar', status: 'suspended', statusReason: 'Complaint' })] })
    render(<AdminVenues />)

    fireEvent.click(await screen.findByRole('tab', { name: /Approved/ }))
    expect(await screen.findByRole('button', { name: 'Suspend' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Suspended/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reinstate' }))
    await waitFor(() => expect(venueApi.adminDecide).toHaveBeenCalledWith('v3', 'reinstate', undefined))
  })

  it('turns the whole feature on or off, after confirming', async () => {
    venueApi.adminVenues.mockResolvedValue({ data: [] })
    venueApi.adminSetVenues.mockResolvedValue({ data: {} })
    render(<AdminVenues />)

    const toggle = await screen.findByRole('switch', { name: 'Venue accounts' })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(toggle)
    await waitFor(() => expect(venueApi.adminSetVenues).toHaveBeenCalledWith(false))
    expect(feedback.confirm).toHaveBeenCalled()
  })

  it('shows whether the address lookup found the address, so the reviewer knows what to check', async () => {
    venueApi.adminVenues.mockResolvedValue({ data: [v({ addressMatched: true, matchedAddress: '1 MAIN ST, AUSTIN, TX' }), v({ id: 'v2', businessName: 'Odd Place', addressMatched: false })] })
    render(<AdminVenues />)

    expect(await screen.findByText('Address found: 1 MAIN ST, AUSTIN, TX')).toBeInTheDocument()
    expect(screen.getByText(/could not find this address/)).toBeInTheDocument()
  })

  it('has an empty state when nothing is waiting', async () => {
    venueApi.adminVenues.mockResolvedValue({ data: [] })
    render(<AdminVenues />)
    expect(await screen.findByText('No venues are waiting')).toBeInTheDocument()
  })
})
