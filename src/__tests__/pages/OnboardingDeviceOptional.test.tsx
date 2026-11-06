import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Onboarding from '@/pages/Onboarding'

const api = vi.hoisted(() => ({
  createProfileOnboarding: vi.fn(), login: vi.fn(), post: vi.fn(), sendOnboardingVerification: vi.fn(), validateOnboardingCode: vi.fn(),
  checkDeviceExists: vi.fn(), checkDetectedDeviceBySerialNumber: vi.fn(), registerDeviceOnboarding: vi.fn(), createConnectAccount: vi.fn(), getConnectAccountStatus: vi.fn()
}))
vi.mock('@/services/api', () => ({ default: api, apiService: api }))
const venueApi = vi.hoisted(() => ({ features: vi.fn(), invitePreview: vi.fn() }))
vi.mock('@/services/venueApi', () => ({ venueApi }))
vi.mock('@/utils/encryption', () => ({ getEncryptDecryptNoUserName: vi.fn(async () => undefined) }))

const navigation = { href: '' }
const renderAt = (url = '/onboarding') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/venue" element={<p>VENUE PORTAL</p>} />
      </Routes>
    </MemoryRouter>
  )

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

const createPerformerAccount = async () => {
  type('First name', 'Ann'); type('Last name', 'Singer'); type('Stage name', 'Annie')
  type('Email', 'ann@x.test'); type('Password', 'password1'); type('Confirm password', 'password1')
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } })
}

describe('the device is optional in onboarding', () => {
  beforeEach(() => {
    Object.values(api).forEach(f => f.mockReset())
    venueApi.features.mockReset().mockResolvedValue({ data: { venues: true } })
    venueApi.invitePreview.mockReset().mockResolvedValue({ data: null })
    api.createProfileOnboarding.mockResolvedValue({ data: {} })
    api.sendOnboardingVerification.mockResolvedValue({ data: {} })
    api.validateOnboardingCode.mockResolvedValue({ data: {} })
    api.login.mockResolvedValue({ data: { accessToken: 'tok', refreshToken: 'ref' } })
    api.post.mockResolvedValue({ data: { onboardingUrl: 'https://connect.stripe.test/setup' } })
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, get href() { return navigation.href }, set href(v: string) { navigation.href = v } } })
    navigation.href = ''
  })

  it('a performer without an invite can skip the device step and go straight to payouts', async () => {
    renderAt()
    await screen.findByLabelText('Stage name')
    await createPerformerAccount()

    expect(await screen.findByLabelText('Serial number')).toBeInTheDocument()
    expect(screen.getByText(/Optional: you can add it later/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))

    expect(await screen.findByRole('button', { name: 'Verify identity with Stripe' })).toBeEnabled()
    expect(screen.getByText('Stripe handles payouts. They will ask you to verify who you are.')).toBeInTheDocument()
    expect(api.registerDeviceOnboarding).not.toHaveBeenCalled()
  })

  it('payouts work without a device: signs in and uses the profile-level Stripe set-up', async () => {
    renderAt()
    await screen.findByLabelText('Stage name')
    await createPerformerAccount()
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Verify identity with Stripe' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/stripe/profile-onboarding-link', {}))
    expect(api.login).toHaveBeenCalledWith({ email: 'ann@x.test', password: 'password1' })
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'tok')
    expect(api.createConnectAccount).not.toHaveBeenCalled() // the device-based path is not used
    await waitFor(() => expect(navigation.href).toBe('https://connect.stripe.test/setup'))
  })

  it('uses the verification link when a Stripe account already exists', async () => {
    api.post.mockImplementation(async (url: string) =>
      url.includes('onboarding-link') ? { data: { message: 'Stripe account already exists' } } : { data: { onboardingUrl: 'https://connect.stripe.test/verify' } })
    renderAt()
    await screen.findByLabelText('Stage name')
    await createPerformerAccount()
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Verify identity with Stripe' }))

    await waitFor(() => expect(navigation.href).toBe('https://connect.stripe.test/verify'))
    expect(api.post).toHaveBeenCalledWith('/api/stripe/profile-verification-link', {})
  })

  it('says what went wrong, with a way to retry, when Stripe cannot be started', async () => {
    api.post.mockResolvedValue({ error: 'Failed to create onboarding link' })
    renderAt()
    await screen.findByLabelText('Stage name')
    await createPerformerAccount()
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Verify identity with Stripe' }))

    expect(await screen.findByText('Failed to create onboarding link')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify identity with Stripe' })).toBeEnabled()
  })

  it('a performer invited by a venue never sees the device step: verify, then payouts as step 3 of 3', async () => {
    venueApi.invitePreview.mockResolvedValue({ data: { venueName: 'Rockin J PianoBar', email: 'ann@x.test' } })
    renderAt('/onboarding?invite=tok123')
    expect(await screen.findByText('Rockin J PianoBar invited you')).toBeInTheDocument()
    expect(screen.getByText(/You'll need a photo ID to set up payouts/)).toBeInTheDocument()
    await createPerformerAccount()

    expect(await screen.findByRole('button', { name: 'Verify identity with Stripe' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Serial number')).toBeNull()
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('a venue can skip the device too, and goes to its finish screen', async () => {
    renderAt()
    fireEvent.click(await screen.findByRole('radio', { name: /Venue/ }))
    type('Business name', 'The Flying J'); type('Contact first name', 'Val'); type('Contact last name', 'Owner')
    type('Phone number', '(512) 555-0100'); type('Street address', '1 Main St'); type('City', 'Austin'); type('State', 'TX'); type('Zip code', '78701')
    type('Email', 'val@venue.test'); type('Password', 'password1'); type('Confirm password', 'password1')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }))

    expect(await screen.findByText('Your venue is set up')).toBeInTheDocument()
    expect(api.registerDeviceOnboarding).not.toHaveBeenCalled()
  })
})
