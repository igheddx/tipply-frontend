import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Onboarding from '@/pages/Onboarding'

const api = vi.hoisted(() => ({
  createProfileOnboarding: vi.fn(), request: vi.fn(), login: vi.fn(), sendOnboardingVerification: vi.fn(), validateOnboardingCode: vi.fn(),
  checkDeviceExists: vi.fn(), checkDetectedDeviceBySerialNumber: vi.fn(), registerDeviceOnboarding: vi.fn()
}))
vi.mock('@/services/api', () => ({ default: api, apiService: api }))
const venueApi = vi.hoisted(() => ({ features: vi.fn(), invitePreview: vi.fn() }))
vi.mock('@/services/venueApi', () => ({ venueApi }))
vi.mock('@/utils/encryption', () => ({ getEncryptDecryptNoUserName: vi.fn(async () => undefined) }))

const renderAt = (url = '/onboarding') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Onboarding />
    </MemoryRouter>
  )

describe('onboarding for venues', () => {
  beforeEach(() => {
    api.createProfileOnboarding.mockReset().mockResolvedValue({ data: {} })
    venueApi.features.mockReset().mockResolvedValue({ data: { venues: true } })
    venueApi.invitePreview.mockReset().mockResolvedValue({ data: null })
  })

  it('offers Performer or Venue when venues are switched on, performer by default', async () => {
    renderAt()
    expect(await screen.findByRole('radio', { name: /Venue/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Performer/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Stage name')).toBeInTheDocument()
  })

  it('does not mention venues at all when the feature is off', async () => {
    venueApi.features.mockResolvedValue({ data: { venues: false } })
    renderAt()
    await screen.findByLabelText('Stage name')
    await waitFor(() => expect(venueApi.features).toHaveBeenCalled())
    expect(screen.queryByRole('radio', { name: /Venue/ })).toBeNull()
  })

  it('choosing Venue swaps the fields: business and address in, stage name out, one step fewer', async () => {
    renderAt()
    fireEvent.click(await screen.findByRole('radio', { name: /Venue/ }))

    expect(screen.getByLabelText('Business name')).toBeInTheDocument()
    expect(screen.getByLabelText('Street address')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument()
    expect(screen.getByLabelText('Contact first name')).toBeInTheDocument()
    expect(screen.queryByLabelText('Stage name')).toBeNull()
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    expect(screen.queryByText('Get paid')).toBeNull()
  })

  it('asks for every venue detail and the terms before creating the account', async () => {
    renderAt()
    fireEvent.click(await screen.findByRole('radio', { name: /Venue/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Enter the business name')).toBeInTheDocument()
    expect(screen.getByText('Enter a phone number with area code')).toBeInTheDocument()
    expect(screen.getByText('Enter the street address')).toBeInTheDocument()
    expect(screen.getByText('Enter the city')).toBeInTheDocument()
    expect(screen.getByText('Please accept the venue terms')).toBeInTheDocument()
    expect(api.createProfileOnboarding).not.toHaveBeenCalled()
  })

  it('sends the venue details with the account', async () => {
    renderAt()
    fireEvent.click(await screen.findByRole('radio', { name: /Venue/ }))
    const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
    type('Business name', 'The Flying J')
    type('Contact first name', 'Val')
    type('Contact last name', 'Owner')
    type('Phone number', '(512) 555-0100')
    type('Street address', '1 Main St')
    type('City', 'Austin')
    type('State', 'TX')
    type('Zip code', '78701')
    type('Email', 'val@venue.test')
    type('Password', 'password1')
    type('Confirm password', 'password1')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(api.createProfileOnboarding).toHaveBeenCalled())
    expect(api.createProfileOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ accountType: 'venue', businessName: 'The Flying J', addressLine1: '1 Main St', city: 'Austin', state: 'TX', postalCode: '78701', acceptTerms: true, email: 'val@venue.test' })
    )
  })

  it('a performer invited by a venue sees who invited them, with the email filled in and no Venue choice', async () => {
    venueApi.invitePreview.mockResolvedValue({ data: { venueName: 'The Flying J', email: 'new@x.test' } })
    renderAt('/onboarding?invite=abc123')

    expect(await screen.findByText('The Flying J invited you')).toBeInTheDocument()
    expect(venueApi.invitePreview).toHaveBeenCalledWith('abc123')
    await waitFor(() => expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('new@x.test'))
    expect(screen.queryByRole('radio', { name: /Venue/ })).toBeNull()
  })

  it('walks a venue through to the end: three steps, a finish screen (never blank), then the venue portal', async () => {
    api.sendOnboardingVerification.mockResolvedValue({ data: {} })
    api.validateOnboardingCode.mockResolvedValue({ data: {} })
    api.checkDeviceExists.mockResolvedValue({ data: { exists: false } })
    api.checkDetectedDeviceBySerialNumber.mockResolvedValue({ data: { exists: true } })
    api.registerDeviceOnboarding.mockResolvedValue({ data: {} })
    api.login.mockResolvedValue({ data: { accessToken: 'tok', refreshToken: 'ref' } })

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/venue" element={<p>VENUE PORTAL</p>} />
          <Route path="/login" element={<p>LOGIN PAGE</p>} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.click(await screen.findByRole('radio', { name: /Venue/ }))
    const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
    type('Business name', 'The Flying J'); type('Contact first name', 'Val'); type('Contact last name', 'Owner')
    type('Phone number', '(512) 555-0100'); type('Street address', '1 Main St'); type('City', 'Austin'); type('State', 'TX'); type('Zip code', '78701')
    type('Email', 'val@venue.test'); type('Password', 'password1'); type('Confirm password', 'password1')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    // Step 2: the emailed code
    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } })
    // Step 3: the device
    fireEvent.change(await screen.findByLabelText('Serial number'), { target: { value: 'TPY-5C07-K73' } })
    expect(screen.queryByText('Let people request songs')).toBeNull() // song requests belong to performers
    fireEvent.click(screen.getByRole('button', { name: 'Add device' }))

    // The finish screen
    expect(await screen.findByText('Your venue is set up')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to your venue portal' }))

    expect(await screen.findByText('VENUE PORTAL')).toBeInTheDocument()
    expect(api.registerDeviceOnboarding).toHaveBeenCalledWith(expect.objectContaining({ isAllowSongRequest: false }))
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'tok')
  })
})
