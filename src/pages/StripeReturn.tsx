
import { BrandIcon } from '../components/icons/BrandIcons'
import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const StripeReturn: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const setupIntentId = searchParams.get('setup_intent')
    const setupIntentClientSecret = searchParams.get('setup_intent_client_secret')

    if (setupIntentId && setupIntentClientSecret) {
      // Handle successful setup
      setStatus('success')
    } else {
      setStatus('error')
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        {status === 'loading' && (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-ink-500">Processing payment setup...</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="mb-4 flex justify-center"><BrandIcon name="check-circle" size={64} color="#15803D" /></div>
            <h1 className="text-2xl font-bold text-ink-900 mb-2">
              Payment Method Added!
            </h1>
            <p className="text-ink-500 mb-6">
              Your payment method has been successfully added and you can now make tips.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
            >
              Continue
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="mb-4 flex justify-center"><BrandIcon name="error" size={64} color="#DC2626" /></div>
            <h1 className="text-2xl font-bold text-ink-900 mb-2">
              Setup Failed
            </h1>
            <p className="text-ink-500 mb-6">
              There was an issue setting up your payment method. Please try again.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary"
            >
              Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default StripeReturn 