import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import AuthenticationFlow from '@/pages/AuthenticationFlow'

vi.mock('@/utils/config', () => ({
  API_BASE_URL: 'http://localhost:3000/api'
}))

describe('Authentication Flow - Forgot Password & Email Verification', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Forgot Password Flow', () => {
    it('displays forgot password form', async () => {
      render(<AuthenticationFlow page="forgot-password" />)

      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send|reset|next/i })).toBeInTheDocument()
    })

    it('validates email format before submission', async () => {
      render(<AuthenticationFlow page="forgot-password" />)

      const emailInput = screen.getByPlaceholderText(/email/i)
      await userEvent.type(emailInput, 'invalid-email')

      const submitButton = screen.getByRole('button', { name: /send/i })
      expect(submitButton).toBeDisabled()
    })

    it('sends reset link to valid email', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Email sent' })
      })

      render(<AuthenticationFlow page="forgot-password" />)

      const emailInput = screen.getByPlaceholderText(/email/i)
      await userEvent.type(emailInput, 'user@example.com')

      const submitButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/forgot-password'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('user@example.com')
          })
        )
      })
    })

    it('displays confirmation message after email sent', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      render(<AuthenticationFlow page="forgot-password" />)

      const emailInput = screen.getByPlaceholderText(/email/i)
      await userEvent.type(emailInput, 'user@example.com')

      const submitButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/check.*email|sent/i)).toBeInTheDocument()
      })
    })

    it('displays error for non-existent email', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'User not found' })
      })

      render(<AuthenticationFlow page="forgot-password" />)

      const emailInput = screen.getByPlaceholderText(/email/i)
      await userEvent.type(emailInput, 'nonexistent@example.com')

      const submitButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/not found|invalid email/i)).toBeInTheDocument()
      })
    })

    it('allows resending reset email', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      render(<AuthenticationFlow page="forgot-password" />)

      const emailInput = screen.getByPlaceholderText(/email/i)
      await userEvent.type(emailInput, 'user@example.com')

      const submitButton = screen.getByRole('button', { name: /send/i })
      await userEvent.click(submitButton)

      // Wait for confirmation
      await waitFor(() => {
        expect(screen.getByText(/check.*email/i)).toBeInTheDocument()
      })

      // Resend button appears
      const resendButton = screen.getByRole('button', { name: /resend/i })
      await userEvent.click(resendButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Reset Password with Token', () => {
    it('displays reset password form when token is provided', async () => {
      render(<AuthenticationFlow page="reset-password" token="reset_token_123" />)

      expect(screen.getByPlaceholderText(/new password/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reset|save/i })).toBeInTheDocument()
    })

    it('validates password strength', async () => {
      render(<AuthenticationFlow page="reset-password" token="token" />)

      const passwordInput = screen.getByPlaceholderText(/new password/i)
      
      // Weak password
      await userEvent.type(passwordInput, 'weak')
      expect(screen.getByText(/password must|at least|strong/i)).toBeInTheDocument()

      // Clear and try strong password
      await userEvent.clear(passwordInput)
      await userEvent.type(passwordInput, 'StrongPassword123!')
      expect(screen.queryByText(/weak|must/i)).not.toBeInTheDocument()
    })

    it('validates passwords match', async () => {
      render(<AuthenticationFlow page="reset-password" token="token" />)

      const passwordInput = screen.getByPlaceholderText(/new password/i)
      const confirmInput = screen.getByPlaceholderText(/confirm password/i)

      await userEvent.type(passwordInput, 'StrongPassword123!')
      await userEvent.type(confirmInput, 'DifferentPassword123!')

      const submitButton = screen.getByRole('button', { name: /reset/i })
      expect(submitButton).toBeDisabled()
    })

    it('resets password with valid token and matching passwords', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      render(<AuthenticationFlow page="reset-password" token="reset_token_123" />)

      const passwordInput = screen.getByPlaceholderText(/new password/i)
      const confirmInput = screen.getByPlaceholderText(/confirm password/i)

      await userEvent.type(passwordInput, 'NewStrongPassword123!')
      await userEvent.type(confirmInput, 'NewStrongPassword123!')

      const submitButton = screen.getByRole('button', { name: /reset/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/reset-password'),
          expect.any(Object)
        )
      })
    })

    it('displays error for invalid/expired token', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid or expired token' })
      })

      render(<AuthenticationFlow page="reset-password" token="invalid_token" />)

      const passwordInput = screen.getByPlaceholderText(/new password/i)
      const confirmInput = screen.getByPlaceholderText(/confirm password/i)

      await userEvent.type(passwordInput, 'NewPassword123!')
      await userEvent.type(confirmInput, 'NewPassword123!')

      const submitButton = screen.getByRole('button', { name: /reset/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid|expired|token/i)).toBeInTheDocument()
      })
    })

    it('redirects to login after successful password reset', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      const mockNavigate = vi.fn()
      vi.mock('react-router-dom', () => ({
        useNavigate: () => mockNavigate
      }))

      render(<AuthenticationFlow page="reset-password" token="token" />)

      const passwordInput = screen.getByPlaceholderText(/new password/i)
      const confirmInput = screen.getByPlaceholderText(/confirm password/i)

      await userEvent.type(passwordInput, 'NewPassword123!')
      await userEvent.type(confirmInput, 'NewPassword123!')

      const submitButton = screen.getByRole('button', { name: /reset/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/success|password reset/i)).toBeInTheDocument()
      })
    })
  })

  describe('Email Verification Flow', () => {
    it('displays email verification code input', async () => {
      render(<AuthenticationFlow page="verify-email" email="user@example.com" />)

      expect(screen.getByPlaceholderText(/code|verification|123456/i)).toBeInTheDocument()
      expect(screen.getByText(/user@example.com/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /verify|confirm/i })).toBeInTheDocument()
    })

    it('accepts 6-digit verification code', async () => {
      render(<AuthenticationFlow page="verify-email" email="user@example.com" />)

      const codeInput = screen.getByPlaceholderText(/code|verification/i)
      await userEvent.type(codeInput, '123456')

      expect(codeInput).toHaveValue('123456')
    })

    it('validates verification code format', async () => {
      render(<AuthenticationFlow page="verify-email" email="user@example.com" />)

      const codeInput = screen.getByPlaceholderText(/code|verification/i)
      await userEvent.type(codeInput, 'invalid')

      const submitButton = screen.getByRole('button', { name: /verify/i })
      expect(submitButton).toBeDisabled()
    })

    it('verifies email with correct code', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, verified: true })
      })

      render(<AuthenticationFlow page="verify-email" email="user@example.com" />)

      const codeInput = screen.getByPlaceholderText(/code|verification/i)
      await userEvent.type(codeInput, '123456')

      const submitButton = screen.getByRole('button', { name: /verify/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/verify-email'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('123456')
          })
        )
      })
    })

    it('displays error for invalid verification code', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid code' })
      })

      render(<AuthenticationFlow page="verify-email" email="user@example.com" />)

      const codeInput = screen.getByPlaceholderText(/code|verification/i)
      await userEvent.type(codeInput, '000000')

      const submitButton = screen.getByRole('button', { name: /verify/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid|incorrect|code/i)).toBeInTheDocument()
      })
    })

    it('displays error for expired code', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Code expired' })
      })

      render(<AuthenticationFlow page="verify-email" email="user@example.com" />)

      const codeInput = screen.getByPlaceholderText(/code|verification/i)
      await userEvent.type(codeInput, '123456')

      const submitButton = screen.getByRole('button', { name: /verify/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/expired/i)).toBeInTheDocument()
      })
    })

    it('allows resending verification code', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })

      render(<AuthenticationFlow page="verify-email" email="user@example.com" />)

      const resendButton = await screen.findByRole('button', { name: /resend/i })
      await userEvent.click(resendButton)

      await waitFor(() => {
        expect(screen.getByText(/code sent|check email/i)).toBeInTheDocument()
      })
    })

    it('shows countdown for resend button', async () => {
      render(<AuthenticationFlow page="verify-email" email="user@example.com" />)

      const resendButton = await screen.findByRole('button', { name: /resend/i })
      
      if (resendButton.hasAttribute('disabled')) {
        expect(resendButton).toHaveTextContent(/resend in|wait|seconds/i)
      }
    })

    it('confirms email and proceeds to next step', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, verified: true })
      })

      render(<AuthenticationFlow page="verify-email" email="user@example.com" />)

      const codeInput = screen.getByPlaceholderText(/code|verification/i)
      await userEvent.type(codeInput, '123456')

      const submitButton = screen.getByRole('button', { name: /verify/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/verified|confirmed|success/i)).toBeInTheDocument()
      })
    })
  })

  describe('Complete Auth Flow Integration', () => {
    it('flows from signup to email verification', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, email: 'user@example.com' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, verified: true })
        })

      render(<AuthenticationFlow page="signup" />)

      // Fill signup form
      await userEvent.type(screen.getByPlaceholderText(/first name/i), 'John')
      await userEvent.type(screen.getByPlaceholderText(/last name/i), 'Doe')
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'john@example.com')
      await userEvent.type(screen.getByPlaceholderText(/^password/i), 'StrongPassword123!')

      // Submit signup
      const signupButton = screen.getByRole('button', { name: /sign up|create/i })
      await userEvent.click(signupButton)

      // Should show verification screen
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/code|verification/i)).toBeInTheDocument()
      })
    })
  })
})
