import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { navigate, api } = vi.hoisted(() => ({
  navigate: vi.fn(),
  api: {
    createProfileOnboarding: vi.fn(),
    sendOnboardingVerification: vi.fn(),
    validateOnboardingCode: vi.fn(),
    login: vi.fn(),
    post: vi.fn(),
    checkDeviceExists: vi.fn(),
    checkDetectedDeviceBySerialNumber: vi.fn()
  }
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate, useSearchParams: () => [new URLSearchParams()] }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))
// venues are switched off, so the page offers only the performer sign-up
vi.mock('@/services/venueApi', () => ({ venueApi: { features: vi.fn(async () => ({ data: { venues: false } })), invitePreview: vi.fn(async () => ({ data: null })) } }))
vi.mock('@/utils/encryption', () => ({ getEncryptDecryptNoUserName: async () => 'key' }))

import Onboarding from '@/pages/Onboarding'

beforeEach(() => {
  navigate.mockReset()
  Object.values(api).forEach(f => f.mockReset())
  localStorage.getItem = vi.fn(() => null)
  localStorage.setItem = vi.fn()
  sessionStorage.clear()
})

const open = async () => {
  render(<Onboarding />)
  await screen.findByRole('heading', { name: 'Set up Tipwave' })
}

const fillAccount = async (over: Partial<Record<'first' | 'last' | 'stage' | 'email' | 'password' | 'confirm', string>> = {}) => {
  const v = { first: 'Dave', last: 'Lovett', stage: 'Dave Lovett Piano', email: 'dave@example.com', password: 'Str0ng!Passw0rd', confirm: 'Str0ng!Passw0rd', ...over }
  await userEvent.type(screen.getByLabelText('First name'), v.first)
  await userEvent.type(screen.getByLabelText('Last name'), v.last)
  await userEvent.type(screen.getByLabelText(/Stage name/), v.stage)
  await userEvent.type(screen.getByLabelText('Email'), v.email)
  await userEvent.type(screen.getByLabelText('Password'), v.password)
  await userEvent.type(screen.getByLabelText('Confirm password'), v.confirm)
}

const createAccount = () => userEvent.click(screen.getByRole('button', { name: 'Create account' }))

describe('Onboarding, step 1: the account', () => {
  it('opens on the account step for a performer', async () => {
    await open()
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText(/Stage name/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('names what is missing and sends nothing when the form is empty', async () => {
    await open()

    await createAccount()

    expect(await screen.findByText('Enter your first name')).toBeInTheDocument()
    expect(screen.getByText('Enter your last name')).toBeInTheDocument()
    expect(screen.getByText('Enter the name your audience will see')).toBeInTheDocument()
    expect(screen.getByText('Enter your email')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()
    expect(api.createProfileOnboarding).not.toHaveBeenCalled()
  })

  it('refuses an email that is not an email', async () => {
    await open()
    await fillAccount({ email: 'not-an-email' })

    await createAccount()

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(api.createProfileOnboarding).not.toHaveBeenCalled()
  })

  it('refuses a short password and two passwords that differ', async () => {
    await open()
    await fillAccount({ password: 'short', confirm: 'different' })

    await createAccount()

    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(api.createProfileOnboarding).not.toHaveBeenCalled()
  })

  it('creates the account, sends a code to that email, and moves on to the code', async () => {
    api.createProfileOnboarding.mockResolvedValue({ data: { id: 'p1' } })
    api.sendOnboardingVerification.mockResolvedValue({ data: { message: 'sent' } })
    await open()
    await fillAccount()

    await createAccount()

    expect(await screen.findByLabelText('Verification code')).toBeInTheDocument()
    expect(api.createProfileOnboarding).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Dave', lastName: 'Lovett', stageName: 'Dave Lovett Piano', email: 'dave@example.com', password: 'Str0ng!Passw0rd'
    }))
    expect(api.sendOnboardingVerification).toHaveBeenCalledWith('dave@example.com')
  })

  it('shows why the account could not be made, and stays on the account step', async () => {
    api.createProfileOnboarding.mockResolvedValue({ error: 'That email is already in use' })
    await open()
    await fillAccount()

    await createAccount()

    expect(await screen.findByText('That email is already in use')).toBeInTheDocument()
    expect(api.sendOnboardingVerification).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Verification code')).toBeNull()
  })

  it('does not go on when the code could not be sent', async () => {
    api.createProfileOnboarding.mockResolvedValue({ data: { id: 'p1' } })
    api.sendOnboardingVerification.mockResolvedValue({ error: 'Could not send the email' })
    await open()
    await fillAccount()

    await createAccount()

    expect(await screen.findByText('Could not send the email')).toBeInTheDocument()
    expect(screen.queryByLabelText('Verification code')).toBeNull()
  })

  it('is three steps for a performer: account, email, payouts. The device comes later', async () => {
    await open()
    expect(screen.getAllByText('Create account').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Verify email').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Get paid').length).toBeGreaterThan(0)
    expect(screen.queryByText('Add your device')).toBeNull()
    expect(screen.getByText(/You can add your device afterwards/)).toBeInTheDocument()
  })

  it('offers sign-in to someone who already has an account', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(navigate).toHaveBeenCalledWith('/login')
  })
})

describe('Onboarding, step 2: the email code', () => {
  const toCodeStep = async () => {
    api.createProfileOnboarding.mockResolvedValue({ data: { id: 'p1' } })
    api.sendOnboardingVerification.mockResolvedValue({ data: { message: 'sent' } })
    await open()
    await fillAccount()
    await createAccount()
    await screen.findByLabelText('Verification code')
  }

  it('cannot be sent until all six digits are in', async () => {
    await toCodeStep()

    await userEvent.type(screen.getByLabelText('Verification code'), '123')

    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled()
  })

  it('checks the code by itself once the sixth digit is in, against the same email, and goes on to payouts when it is right', async () => {
    api.validateOnboardingCode.mockResolvedValue({ data: { message: 'ok' } })
    await toCodeStep()

    await userEvent.type(screen.getByLabelText('Verification code'), '123456') // no button to press

    await waitFor(() => expect(api.validateOnboardingCode).toHaveBeenCalledWith('dave@example.com', '123456'))
    // straight on to payouts: there is no device step in sign-up (the device is added afterwards)
    expect(await screen.findByRole('button', { name: 'Verify identity with Stripe' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Serial number')).toBeNull()
  })

  it('says the code is wrong and stays, without moving the person on', async () => {
    api.validateOnboardingCode.mockResolvedValue({ error: 'That code is not right' })
    await toCodeStep()

    await userEvent.type(screen.getByLabelText('Verification code'), '000000')

    expect(await screen.findByText('That code is not right')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify identity with Stripe' })).toBeNull()
  })
})
