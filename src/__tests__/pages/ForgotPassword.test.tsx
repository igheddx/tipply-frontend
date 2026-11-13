import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const { navigate, api } = vi.hoisted(() => ({
  navigate: vi.fn(),
  api: { forgotPassword: vi.fn(), validateResetCode: vi.fn(), resetPassword: vi.fn() }
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))

import ForgotPassword from '@/pages/ForgotPassword'

beforeEach(() => {
  navigate.mockReset()
  Object.values(api).forEach(f => f.mockReset())
  sessionStorage.clear()
})

afterEach(() => vi.useRealTimers())

const askForCode = async (email = 'dave@example.com') => {
  await userEvent.type(screen.getByPlaceholderText('Enter your email'), email)
  await userEvent.click(screen.getByRole('button', { name: 'Send Verification Code' }))
}

const enterCode = async (code = '123456') => {
  await userEvent.type(await screen.findByPlaceholderText('000000'), code)
  await userEvent.click(screen.getByRole('button', { name: 'Verify Code' }))
}

describe('ForgotPassword, step 1: the email', () => {
  it('asks for an email and sends a code to it', async () => {
    api.forgotPassword.mockResolvedValue({ data: { message: 'sent' } })
    render(<ForgotPassword />)

    await askForCode('dave@example.com')

    expect(api.forgotPassword).toHaveBeenCalledWith('dave@example.com')
    expect(await screen.findByPlaceholderText('000000')).toBeInTheDocument() // on to the code
  })

  it('shows the server\'s message and stays on the email when no code could be sent', async () => {
    api.forgotPassword.mockResolvedValue({ error: 'No account with that email' })
    render(<ForgotPassword />)

    await askForCode()

    expect(await screen.findByText('No account with that email')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('000000')).toBeNull()
  })

  it('says something went wrong when the request fails', async () => {
    api.forgotPassword.mockRejectedValue(new Error('offline'))
    render(<ForgotPassword />)

    await askForCode()

    expect(await screen.findByText('An error occurred. Please try again.')).toBeInTheDocument()
  })
})

describe('ForgotPassword, step 2: the code', () => {
  const toCodeStep = async () => {
    api.forgotPassword.mockResolvedValue({ data: { message: 'sent' } })
    render(<ForgotPassword />)
    await askForCode()
  }

  it('checks the code with the email it was sent to, then asks for a new password', async () => {
    api.validateResetCode.mockResolvedValue({ data: { message: 'ok' } })
    await toCodeStep()

    await enterCode('123456')

    expect(api.validateResetCode).toHaveBeenCalledWith('dave@example.com', '123456')
    expect(await screen.findByPlaceholderText('Enter new password')).toBeInTheDocument()
  })

  it('refuses a wrong code and keeps asking for it', async () => {
    api.validateResetCode.mockResolvedValue({ data: { error: 'Invalid or expired code' } })
    await toCodeStep()

    await enterCode('000000')

    expect(await screen.findByText('Invalid or expired code')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Enter new password')).toBeNull()
  })
})

describe('ForgotPassword, step 3: the new password', () => {
  const toPasswordStep = async () => {
    api.forgotPassword.mockResolvedValue({ data: { message: 'sent' } })
    api.validateResetCode.mockResolvedValue({ data: { message: 'ok' } })
    render(<ForgotPassword />)
    await askForCode()
    await enterCode('123456')
    await screen.findByPlaceholderText('Enter new password')
  }

  const type = async (password: string, confirm: string) => {
    await userEvent.type(screen.getByPlaceholderText('Enter new password'), password)
    await userEvent.type(screen.getByPlaceholderText('Confirm new password'), confirm)
    await userEvent.click(screen.getByRole('button', { name: 'Reset Password' }))
  }

  it('refuses two passwords that do not match, and sends nothing', async () => {
    await toPasswordStep()

    await type('Str0ng!Passw0rd', 'Different!Passw0rd')

    expect((await screen.findAllByText('Passwords do not match')).length).toBeGreaterThan(0) // next to the field and in the banner
    expect(api.resetPassword).not.toHaveBeenCalled()
  })

  it('refuses a password shorter than 8 characters, and sends nothing', async () => {
    await toPasswordStep()

    await type('Ab1!', 'Ab1!')

    expect((await screen.findAllByText('Password must be at least 8 characters')).length).toBeGreaterThan(0)
    expect(api.resetPassword).not.toHaveBeenCalled()
  })

  it('resets the password with the email and code, remembers a message for the sign-in page, and goes there', async () => {
    api.resetPassword.mockResolvedValue({ data: { message: 'done' } })
    await toPasswordStep()
    vi.useFakeTimers({ shouldAdvanceTime: true })

    await type('Str0ng!Passw0rd', 'Str0ng!Passw0rd')

    await waitFor(() => expect(api.resetPassword).toHaveBeenCalledWith('dave@example.com', '123456', 'Str0ng!Passw0rd'))
    expect(await screen.findByText(/Password reset successfully/)).toBeInTheDocument()
    expect(sessionStorage.getItem('password_reset_message')).toMatch(/log in with your new password/)

    await act(async () => { vi.advanceTimersByTime(2100) })
    expect(navigate).toHaveBeenCalledWith('/login', expect.objectContaining({ state: expect.objectContaining({ message: expect.any(String) }) }))
  })

  it('shows the reasons the server gives when it refuses the new password', async () => {
    api.resetPassword.mockResolvedValue({ data: { error: 'Too weak', validationErrors: ['Add a number', 'Add a symbol'] } })
    await toPasswordStep()

    await type('Str0ng!Passw0rd', 'Str0ng!Passw0rd')

    expect(await screen.findByText('Add a number, Add a symbol')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })
})
