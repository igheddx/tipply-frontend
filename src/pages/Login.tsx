import logger from "../utils/logger";
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { BrandIcon } from '../components/icons/BrandIcons'
import { Banner, Button } from '../components/ui'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showKycSuccess, setShowKycSuccess] = useState(false)
  const [passwordResetMessage, setPasswordResetMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  // Check for KYC completion and password reset on component mount
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const kycCompleted = urlParams.get('kyc_completed')
    
    if (kycCompleted === 'true') {
      setShowKycSuccess(true)
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    // Check for password reset message from navigation state
    const location = window.location as any
    if (location.state?.message) {
      setPasswordResetMessage(location.state.message)
      // Clear the navigation state
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    
    // Also check for message in sessionStorage as fallback
    const storedMessage = sessionStorage.getItem('password_reset_message')
    if (storedMessage) {
      setPasswordResetMessage(storedMessage)
      sessionStorage.removeItem('password_reset_message')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await apiService.login({ email, password })
      
      if (result.error) {
        setError(result.error)
        return
      }

      if (result.data?.accessToken) {
        // Store tokens
        localStorage.setItem('token', result.data.accessToken)
        if (result.data.refreshToken) {
          localStorage.setItem('refreshToken', result.data.refreshToken)
        }
        
        // Check if there's a pending KYC result from onboarding
        const pendingKycResult = sessionStorage.getItem('kyc_result')
        if (pendingKycResult) {
          // Move KYC result to localStorage so dashboard can access it
          localStorage.setItem('kyc_result', pendingKycResult)
          sessionStorage.removeItem('kyc_result')
          logger.log('KYC result moved to localStorage for dashboard display')
        }
        
        // Check if user is admin and redirect accordingly
        if (result.data?.user?.role === 'root_admin') {
          navigate('/admin')
        } else {
          navigate('/dashboard')
        }
      } else {
        setError('Login failed. Please try again.')
      }
    } catch (err) {
      setError('Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGetStarted = () => {
    navigate('/onboarding')
  }

  const inputClass =
    'w-full h-12 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-ink-900 placeholder:text-ink-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/images/logo/tipwave-logo-v2.png" alt="Tipwave" className="mx-auto h-14 w-auto" />
          <h1 className="mt-6 text-3xl font-bold text-ink-900">Welcome back</h1>
          <p className="mt-1 text-ink-500">Sign in to your Tipwave portal</p>
        </div>

        {showKycSuccess && (
          <Banner tone="success" title="Identity verified" className="mb-5">
            Stripe has what it needs. Sign in to start getting paid.
          </Banner>
        )}

        {passwordResetMessage && (
          <Banner tone="success" title="Password reset" className="mb-5">
            Sign in with your new password.
          </Banner>
        )}

        <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Banner tone="error" title="We could not sign you in">
                {error}
              </Banner>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink-700">
                Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <BrandIcon name="mail" size={20} tone="muted" />
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold text-ink-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <BrandIcon name="lock" size={20} tone="muted" />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={`${inputClass} pr-16`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-1 flex w-14 items-center justify-center text-sm font-semibold text-brand-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" block loading={isLoading}>
              Sign in
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <p className="mb-3 text-sm text-ink-500">New to Tipwave?</p>
            <Button variant="secondary" size="lg" block onClick={handleGetStarted}>
              Set up your account
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
