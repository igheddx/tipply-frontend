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
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel: a header band on phones, a full side panel on desktop */}
      <aside
        className="relative overflow-hidden px-6 pb-16 pt-8 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-14"
        style={{
          background:
            'radial-gradient(70% 55% at 100% 0%, rgba(6,182,200,0.35), transparent 70%),' +
            'radial-gradient(60% 50% at 0% 100%, rgba(229,84,140,0.28), transparent 70%),' +
            'linear-gradient(160deg,#0a2533,#0d4254 60%,#0f3447)'
        }}
      >
        {/* Oversized monogram as a quiet background shape */}
        <img
          src="/images/logo/tipwave-monogram.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -right-16 hidden w-[520px] max-w-none opacity-[0.07] lg:block"
        />
        <img src="/images/logo/tipwave-logo-v2-light.png" alt="Tipwave" className="relative h-10 w-auto self-start lg:h-12" />

        <div className="relative mt-8 lg:mt-0">
          <h2 className="text-3xl font-bold leading-tight lg:text-5xl">
            Get tipped.
            <br />
            Get paid.
          </h2>
          <p className="mt-3 max-w-md text-white/75 lg:text-lg">
            Your audience scans, picks an amount and tips. You see it the moment it happens.
          </p>
          <ul className="mt-8 hidden space-y-4 lg:block">
            {[
              { icon: 'qr' as const, text: 'One scan to tip. No app to download.' },
              { icon: 'music' as const, text: 'Take song requests with every tip.' },
              { icon: 'bank' as const, text: 'Payouts go straight to your bank.' }
            ].map(item => (
              <li key={item.text} className="flex items-center gap-3 text-white/90">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <BrandIcon name={item.icon} size={20} color="#7EE3EF" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative hidden text-sm text-white/50 lg:block">© Tipwave</p>
      </aside>

      {/* Form */}
      <main className="relative z-10 -mt-8 px-4 pb-10 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:px-12">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-card lg:bg-transparent lg:p-0 lg:shadow-none">
          <h1 className="text-2xl font-bold text-ink-900 lg:text-3xl">Welcome back</h1>
          <p className="mb-6 mt-1 text-ink-500">Sign in to your Tipwave portal</p>

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
      </main>
    </div>
  )
}

export default Login
