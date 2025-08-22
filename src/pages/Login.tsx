import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showKycSuccess, setShowKycSuccess] = useState(false)
  const [passwordResetMessage, setPasswordResetMessage] = useState('')
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
          console.log('KYC result moved to localStorage for dashboard display')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* KYC Success Message */}
        {showKycSuccess && (
          <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-green-800 mb-2">
                🎉 Congratulations!
              </h3>
              <p className="text-green-700 mb-3">
                You've successfully completed your KYC verification with Stripe!
              </p>
              <p className="text-green-600 text-sm">
                Please sign in below to access your dashboard and start accepting tips.
              </p>
            </div>
          </div>
        )}

        {/* Password Reset Success Message */}
        {passwordResetMessage && (
          <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-blue-800 mb-2">
                🔐 Password Reset Complete!
              </h3>
              <p className="text-blue-700 mb-3">
                Your password has been successfully reset.
              </p>
              <p className="text-blue-600 text-sm">
                Please sign in below with your new password.
              </p>
            </div>
          </div>
        )}

        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-32 h-32 overflow-visible rounded-2xl mb-4">
            <img 
              src="/images/tipply_logo.png" 
              alt="Tipply Logo" 
              className="w-full h-full object-contain"
              style={{ transform: 'scale(1.25)', objectPosition: 'center' }}
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back
          </h2>
          <p className="text-gray-600">
            Sign in to manage your tipping devices
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200"
              >
                Forgot your password?
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-600 text-sm">{error}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold py-3 px-4 rounded-lg hover:from-primary-700 hover:to-primary-800 focus:ring-4 focus:ring-primary-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">New to Tipply?</span>
              </div>
            </div>
          </div>

          {/* Get Started Button */}
          <div className="mt-6">
            <button
              onClick={handleGetStarted}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 focus:ring-4 focus:ring-green-200 transition-all duration-200"
            >
              <div className="flex items-center justify-center space-x-2">
                <span>Get Started</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Secure • Fast • Reliable
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login 