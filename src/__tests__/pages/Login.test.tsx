import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { navigate, api } = vi.hoisted(() => ({ navigate: vi.fn(), api: { login: vi.fn() } }))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))

import Login from '@/pages/Login'

const stored: Record<string, string> = {}

beforeEach(() => {
  navigate.mockReset()
  api.login.mockReset()
  Object.keys(stored).forEach(k => delete stored[k])
  localStorage.getItem = vi.fn((k: string) => stored[k] ?? null)
  localStorage.setItem = vi.fn((k: string, v: string) => { stored[k] = v })
  localStorage.removeItem = vi.fn((k: string) => { delete stored[k] })
  sessionStorage.clear()
})

const signIn = async (email = 'dave@example.com', password = 'secret-pass') => {
  render(<Login />)
  await userEvent.type(screen.getByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('Login', () => {
  it('asks for an email and a password', () => {
    render(<Login />)
    expect(screen.getByLabelText('Email')).toBeRequired()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('sends what was typed, keeps the tokens, and opens a performer\'s dashboard', async () => {
    api.login.mockResolvedValue({ data: { accessToken: 'tok-1', refreshToken: 'ref-1', user: { role: 'user', accountType: 'performer' } } })

    await signIn('dave@example.com', 'secret-pass')

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'))
    expect(api.login).toHaveBeenCalledWith({ email: 'dave@example.com', password: 'secret-pass' })
    expect(stored.token).toBe('tok-1')
    expect(stored.refreshToken).toBe('ref-1')
  })

  it('sends an admin to the admin page', async () => {
    api.login.mockResolvedValue({ data: { accessToken: 'tok-a', user: { role: 'root_admin' } } })
    await signIn()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin'))
  })

  it('sends a venue to the venue page', async () => {
    api.login.mockResolvedValue({ data: { accessToken: 'tok-v', user: { role: 'user', accountType: 'venue' } } })
    await signIn()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/venue'))
  })

  it('shows the server\'s message when the sign-in is refused, and keeps nobody signed in', async () => {
    api.login.mockResolvedValue({ error: 'Invalid email or password' })

    await signIn()

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(stored.token).toBeUndefined()
  })

  it('says it could not sign in when the answer has no token', async () => {
    api.login.mockResolvedValue({ data: {} })

    await signIn()

    expect(await screen.findByText('Login failed. Please try again.')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(stored.token).toBeUndefined()
  })

  it('says it could not sign in when the request itself fails', async () => {
    api.login.mockRejectedValue(new Error('network down'))

    await signIn()

    expect(await screen.findByText('Login failed. Please try again.')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('moves a saved identity check result along, so the dashboard can show it', async () => {
    sessionStorage.setItem('kyc_result', 'verified')
    api.login.mockResolvedValue({ data: { accessToken: 'tok-1', user: { role: 'user' } } })

    await signIn()

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'))
    expect(stored.kyc_result).toBe('verified')
    expect(sessionStorage.getItem('kyc_result')).toBeNull()
  })

  it('offers the password reset and account set-up', async () => {
    render(<Login />)

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(navigate).toHaveBeenCalledWith('/forgot-password')

    fireEvent.click(screen.getByRole('button', { name: 'Set up your account' }))
    expect(navigate).toHaveBeenCalledWith('/onboarding')
  })

  it('says the password was reset, when the person arrives from the reset page', () => {
    sessionStorage.setItem('password_reset_message', 'done')
    render(<Login />)
    expect(screen.getByText('Password reset')).toBeInTheDocument()
  })
})
