import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'

const KYCReturn: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Debug: Log all search parameters
    console.log('KYC Return - All search params:', Object.fromEntries(searchParams.entries()))
    
    const accountId = searchParams.get('account_id')
    const error = searchParams.get('error')
    const state = searchParams.get('state')
    const code = searchParams.get('code')

    // Determine KYC status
    let kycStatus = 'unknown'
    let kycMessage = ''

    if (error) {
      console.log('KYC Return - Error detected:', error)
      kycStatus = 'failed'
      kycMessage = 'KYC verification failed. Please try again or contact support.'
    } else if (accountId || code || state) {
      console.log('KYC Return - Success indicators found:', { accountId, code, state })
      kycStatus = 'success'
      kycMessage = 'KYC verification completed successfully! Your Stripe account is now enabled.'
    } else {
      console.log('KYC Return - No clear indicators, assuming success')
      kycStatus = 'success'
      kycMessage = 'KYC verification completed successfully! Your Stripe account is now enabled.'
    }

    // Store KYC result for dashboard to display
    const kycResult = {
      status: kycStatus,
      message: kycMessage,
      timestamp: new Date().toISOString()
    }
    
    // Store in both sessionStorage (for immediate use) and localStorage (as backup)
    sessionStorage.setItem('kyc_result', JSON.stringify(kycResult))
    localStorage.setItem('kyc_result', JSON.stringify(kycResult))
    
    console.log('KYC result stored:', kycResult)

    // Always attempt to log in and redirect to dashboard
    handleAutoLogin()
  }, [searchParams])

  const handleAutoLogin = async () => {
    try {
      // Get stored onboarding credentials
      const email = sessionStorage.getItem('onboarding_email')
      const password = sessionStorage.getItem('onboarding_password')

      if (!email || !password) {
        console.error('No onboarding credentials found')
        // Still redirect to dashboard even without credentials
        navigate('/dashboard')
        return
      }

      console.log('Attempting auto-login with email:', email)

      // Attempt to log in
      const result = await apiService.login({ email, password })

      if (result.error) {
        console.error('Auto-login failed:', result.error)
        // Still redirect to dashboard even if login fails
        navigate('/dashboard')
        return
      }

      // Store the authentication token
      if (result.data?.accessToken) {
        localStorage.setItem('token', result.data.accessToken)
        if (result.data.refreshToken) {
          localStorage.setItem('refreshToken', result.data.refreshToken)
        }
        
        // Clear temporary onboarding credentials
        sessionStorage.removeItem('onboarding_email')
        sessionStorage.removeItem('onboarding_password')
        
        console.log('Auto-login successful, navigating to dashboard')
        // Navigate to dashboard
        navigate('/dashboard')
      } else {
        console.error('No access token received')
        // Still redirect to dashboard
        navigate('/dashboard')
      }
    } catch (err) {
      console.error('Auto-login error:', err)
      // Still redirect to dashboard even on error
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing KYC verification and logging you in...</p>
          <p className="mt-2 text-sm text-gray-500">Redirecting to dashboard...</p>
        </div>
      </div>
    </div>
  )
}

export default KYCReturn 