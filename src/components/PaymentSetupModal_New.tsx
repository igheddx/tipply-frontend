import logger from "../utils/logger";
import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { toast } from 'sonner'
import { getApiBaseUrl } from '../utils/config'

const stripePromise = loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder')

interface PaymentSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (paymentMethodId?: string) => void
  deviceUuid: string
  userId: string
  performerStageName?: string
  performerFirstName?: string
  performerLastName?: string
  performerPhotoUrl?: string
}

export default function PaymentSetupModal({ 
  isOpen, 
  onClose, 
  onComplete, 
  deviceUuid, 
  userId,
  performerStageName,
  performerFirstName,
  performerLastName,
  performerPhotoUrl
}: PaymentSetupModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Performer Hero Section */}
        <div className="bg-gradient-to-b from-purple-50 to-white px-6 pt-8 pb-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {performerPhotoUrl && (
              <img
                src={performerPhotoUrl}
                alt="Performer"
                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {performerStageName || `${performerFirstName} ${performerLastName}`}
              </h1>
              <p className="text-purple-600 font-medium text-sm mt-1">
                You're about to light up their stage ✨
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <Elements stripe={stripePromise}>
            <PaymentForm 
              deviceUuid={deviceUuid}
              userId={userId}
              onComplete={onComplete}
              onClose={onClose}
            />
          </Elements>
        </div>
      </div>
    </div>
  )
}

function PaymentForm({ 
  deviceUuid, 
  userId, 
  onComplete, 
  onClose 
}: { 
  deviceUuid: string
  userId: string
  onComplete: (paymentMethodId?: string) => void
  onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentRequest, setPaymentRequest] = useState<any>(null)
  const [showCardForm, setShowCardForm] = useState(false)
  const [isApplePay, setIsApplePay] = useState(false)

  useEffect(() => {
    if (stripe) {
      const pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: { label: 'Tipply Tip', amount: 100 },
        requestPayerName: true,
        requestPayerEmail: true,
        displayItems: [{ label: 'Tip Setup', amount: 100 }]
      })
      
      pr.canMakePayment().then((result) => {
        logger.log('Payment Request canMakePayment result:', result)
        logger.log('Is HTTPS:', window.location.protocol === 'https:')
        
        if (result) {
          setPaymentRequest(pr)
          setIsApplePay(!!result.applePay)
          logger.log('Payment Request available - Apple Pay:', result.applePay, 'Google Pay:', result.googlePay)
        } else {
          logger.log('Payment Request not available')
        }
      }).catch((error) => {
        logger.error('Payment Request canMakePayment error:', error)
      })

      pr.on('paymentmethod', async (event) => {
        try {
          setLoading(true)
          setError(null)
          
          const res = await fetch(`${getApiBaseUrl()}/api/stripe/setup-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceUuid, userId })
          })
          
          if (!res.ok) {
            event.complete('fail')
            setError('Failed to set up payment')
            setLoading(false)
            return
          }
          
          const data = await res.json()
          
          const { error, setupIntent } = await stripe.confirmCardSetup(data.clientSecret, {
            payment_method: event.paymentMethod.id,
          })
          
          if (error) {
            event.complete('fail')
            setError(error.message || 'Payment setup failed')
          } else {
            const paymentMethodId = setupIntent?.payment_method as string
            
            const tempUserId = localStorage.getItem('tipply_user_id')
            const customerId = data.customerId
            if (tempUserId && customerId) {
              localStorage.setItem(`stripe_customer_id_${tempUserId}`, customerId)
              localStorage.setItem(`payment_status_${tempUserId}_${deviceUuid}`, JSON.stringify({
                hasPaymentMethods: true,
                paymentMethodType: 'card'
              }))
              localStorage.setItem(`payment_status_timestamp_${tempUserId}_${deviceUuid}`, Date.now().toString())
              
              if (paymentMethodId) {
                localStorage.setItem(`payment_method_id_${tempUserId}`, paymentMethodId)
                localStorage.setItem(`payment_method_timestamp_${tempUserId}`, Date.now().toString())
              }
            }
            
            event.complete('success')
            toast.success('Ready to tip!')
            onComplete(paymentMethodId)
          }
        } catch (error) {
          event.complete('fail')
          setError('Payment setup failed')
        } finally {
          setLoading(false)
        }
      })

      pr.on('cancel', () => {
        // User cancelled
      })
    }
  }, [stripe, deviceUuid, userId, onComplete])

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/stripe/setup-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceUuid, userId })
      })
      
      if (!res.ok) {
        setError(`Setup failed: ${res.status}`)
        setLoading(false)
        return
      }
      
      const data = await res.json()
      
      if (!data.clientSecret) {
        setError('Setup failed')
        setLoading(false)
        return
      }

      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        setError('Card input error')
        setLoading(false)
        return
      }

      const result = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: cardElement,
        },
      })

      if (result.error) {
        setError(result.error.message || 'Card error')
      } else {
        const paymentMethodId = result.setupIntent?.payment_method as string | undefined
        
        const tempUserId = localStorage.getItem('tipply_user_id')
        const customerId = data.customerId
        if (tempUserId && customerId) {
          localStorage.setItem(`stripe_customer_id_${tempUserId}`, customerId)
          localStorage.setItem(`payment_status_${tempUserId}_${deviceUuid}`, JSON.stringify({
            hasPaymentMethods: true,
            paymentMethodType: 'card'
          }))
          localStorage.setItem(`payment_status_timestamp_${tempUserId}_${deviceUuid}`, Date.now().toString())
          
          if (paymentMethodId) {
            localStorage.setItem(`payment_method_id_${tempUserId}`, paymentMethodId)
            localStorage.setItem(`payment_method_timestamp_${tempUserId}`, Date.now().toString())
          }
        }
        
        toast.success('Ready to tip!')
        onComplete(paymentMethodId)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Smart Payment Options */}
      {paymentRequest && (
        <>
          <button
            onClick={() => paymentRequest.show()}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 px-4 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 font-semibold shadow-sm flex items-center justify-center gap-2"
          >
            <img 
              src={isApplePay ? '/images/apple-pay-logo.svg' : '/images/google-pay-logo.svg'}
              alt={isApplePay ? 'Apple Pay' : 'Google Pay'}
              className="w-5 h-5"
            />
            <span>{isApplePay ? 'Continue with Apple Pay' : 'Continue with Google Pay'}</span>
          </button>
          
          <div className="flex items-center gap-3 opacity-40">
            <div className="flex-1 border-t" />
            <span className="text-xs text-gray-500 font-medium">or</span>
            <div className="flex-1 border-t" />
          </div>
        </>
      )}

      {/* Card Form - Only Show When User Clicks Link */}
      {!showCardForm ? (
        <button
          onClick={() => setShowCardForm(true)}
          className="w-full text-purple-600 hover:text-purple-700 py-3 px-4 rounded-lg border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all font-medium text-sm"
        >
          Add Credit Card
        </button>
      ) : (
        <form onSubmit={handleCardSubmit} className="space-y-3">
          <div className="border border-gray-300 rounded-lg p-4 bg-white">
            <CardElement 
              options={{ 
                style: { 
                  base: { 
                    fontSize: '15px',
                    color: '#333',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#dc2626',
                  },
                },
              }} 
            />
          </div>
          
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || !stripe}
              className="flex-1 bg-purple-600 text-white py-2.5 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium text-sm"
            >
              {loading ? 'Processing...' : 'Add Card'}
            </button>
            <button
              type="button"
              onClick={() => setShowCardForm(false)}
              disabled={loading}
              className="px-4 py-2.5 text-gray-700 hover:text-gray-900 font-medium text-sm"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {/* Minimal Security Footer */}
      <div className="pt-3 border-t border-gray-100 mt-4">
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          🔒 Secure payments via Stripe
        </p>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        disabled={loading}
        className="w-full text-gray-600 hover:text-gray-900 py-2 text-sm font-medium transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  )
}
