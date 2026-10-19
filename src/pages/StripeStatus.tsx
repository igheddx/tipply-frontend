
import { BrandIcon } from '../components/icons/BrandIcons'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const StripeStatus: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStripeStatus()
  }, [])

  const fetchStripeStatus = async () => {
    try {
      const response = await fetch('/api/stripe/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data.status || 'Unknown')
      } else {
        setStatus('Error')
      }
    } catch (err) {
      setStatus('Error')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-ink-500">Checking Stripe status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold text-ink-900 mb-4">
          Stripe Status
        </h1>
        
        <div className="card">
          <div className="text-center">
            <div className={`mb-4 flex justify-center ${
              status === 'active' ? 'text-green-600' : 'text-red-600'
            }`}>
              <BrandIcon name={status === 'active' ? 'check-circle' : 'error'} size={56} tone="current" strokeWidth={1.6} />
            </div>
            <h2 className="text-lg font-medium text-ink-900 mb-2">
              {status === 'active' ? 'Stripe is Active' : 'Stripe is Inactive'}
            </h2>
            <p className="text-ink-500">
              {status === 'active' 
                ? 'Your Stripe account is properly configured and ready to process payments.'
                : 'There is an issue with your Stripe configuration. Please check your settings.'
              }
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export default StripeStatus 