import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { toast } from 'sonner'
import { getApiBaseUrl } from '../utils/config'

// Initialize Stripe
const stripePromise = loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder')

interface PaymentSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (paymentMethodId?: string) => void
  deviceUuid: string
  userId: string
}

export default function PaymentSetupModal({ 
  isOpen, 
  onClose, 
  onComplete, 
  deviceUuid, 
  userId 
}: PaymentSetupModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Set Up Payment Method</h2>
        <p className="text-gray-600 mb-6">
          Add a payment method to start tipping. Your payment information is securely stored.
        </p>
        
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
  const [isApplePay, setIsApplePay] = useState(false)

  useEffect(() => {
    if (stripe) {
      const pr = stripe.paymentRequest({
        country: 'US',
        currency: 'usd',
        total: { label: 'Tipply Tip', amount: 100 }, // $1 for setup
        requestPayerName: true,
        requestPayerEmail: true,
        displayItems: [{ label: 'Tip Setup', amount: 100 }]
      })
      
      pr.canMakePayment().then((result) => {
        console.log('Payment Request canMakePayment result:', result)
        console.log('User Agent:', navigator.userAgent)
        console.log('Platform:', navigator.platform)
        if (result) {
          setPaymentRequest(pr)
          setIsApplePay(!!result.applePay)
          console.log('Payment Request is available - Apple Pay:', result.applePay, 'Google Pay:', result.googlePay)
        }
      })

      // Handle payment request events
      pr.on('paymentmethod', async (event) => {
        console.log('Payment Request paymentmethod event:', event)
        try {
          setLoading(true)
          setError(null)
          
          // Get setup intent from backend
          const res = await fetch(`${getApiBaseUrl()}/api/stripe/setup-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceUuid, userId })
          })
          
          if (!res.ok) {
            event.complete('fail')
            setError('Failed to create setup intent')
            setLoading(false)
            return
          }
          
          const data = await res.json()
          
          // Confirm the setup intent with the payment method
          const { error, setupIntent } = await stripe.confirmCardSetup(data.clientSecret, {
            payment_method: event.paymentMethod.id,
          })
          
          if (error) {
            console.error('Payment Request setup error:', error)
            event.complete('fail')
            setError(error.message || 'Payment setup failed')
          } else {
            console.log('Payment Request setup successful:', setupIntent)
            // Store setup success in localStorage
            const tempUserId = localStorage.getItem('tipply_user_id')
            if (tempUserId) {
              localStorage.setItem(`payment_status_${tempUserId}_${deviceUuid}`, JSON.stringify({
                hasPaymentMethods: true,
                paymentMethodType: 'card'
              }))
              localStorage.setItem(`payment_status_timestamp_${tempUserId}_${deviceUuid}`, Date.now().toString())
            }
            event.complete('success')
            toast.success('Payment method added successfully!')
            // Extract payment method ID from the SetupIntent, NOT the event
            const paymentMethodId = setupIntent?.payment_method as string
            console.log('💳 Payment method ID from wallet:', paymentMethodId)
            onComplete(paymentMethodId)
          }
        } catch (error) {
          console.error('Payment Request error:', error)
          event.complete('fail')
          setError('Payment setup failed')
        } finally {
          setLoading(false)
        }
      })

      pr.on('cancel', () => {
        console.log('Payment Request cancelled')
      })
    }
  }, [stripe, deviceUuid, userId, onComplete])

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)
    
    try {
      // Get setup intent from backend
                const res = await fetch(`${getApiBaseUrl()}/api/stripe/setup-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceUuid, userId })
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Setup intent error:', errorText)
        setError(`Server error: ${res.status} - ${errorText}`)
        setLoading(false)
        return
      }
      
      const data = await res.json()
      console.log('Setup intent response:', data)
      
      if (!data.clientSecret) {
        setError('Failed to get setup intent - no client secret')
        setLoading(false)
        return
      }

      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        setError('Card input not found')
        setLoading(false)
        return
      }

      console.log('Confirming card setup with client secret:', data.clientSecret)
      const result = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: cardElement,
        },
      })

      console.log('Card setup result:', result)
      if (result.error) {
        setError(result.error.message || 'Card error')
      } else {
        console.log('Payment method setup successful:', result.setupIntent)
        // Extract payment method ID from the setup intent
        const paymentMethodId = result.setupIntent?.payment_method as string | undefined
        console.log('💳 Payment method ID from card:', paymentMethodId)
        
        // Store setup success in localStorage
        const tempUserId = localStorage.getItem('tipply_user_id')
        if (tempUserId) {
          localStorage.setItem(`payment_status_${tempUserId}_${deviceUuid}`, JSON.stringify({
            hasPaymentMethods: true,
            paymentMethodType: 'card'
          }))
          localStorage.setItem(`payment_status_timestamp_${tempUserId}_${deviceUuid}`, Date.now().toString())
        }
        toast.success('Payment method added successfully!')
        onComplete(paymentMethodId)
      }
    } catch (error) {
      console.error('Card submission error:', error)
      setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {paymentRequest ? (
        <div className="mb-4">
          <div className="mb-2">
            <button
              onClick={() => paymentRequest.show()}
              disabled={loading}
              className="w-full bg-black text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isApplePay ? 'Pay with Apple Pay' : 'Pay with Google Pay'}
            </button>
          </div>
          <div className="text-center text-xs text-gray-500">
            {isApplePay ? 'Apple Pay' : 'Google Pay'} supported
          </div>
        </div>
      ) : (
        <div className="text-center text-sm text-gray-500 mb-4">
          Apple Pay / Google Pay not available
        </div>
      )}
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">Or add a card</span>
        </div>
      </div>

      <form onSubmit={handleCardSubmit} className="space-y-4">
        <div className="border rounded-lg p-3">
          <CardElement 
            options={{ 
              style: { 
                base: { 
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }} 
          />
        </div>
        
        {error && (
          <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !stripe}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Add Payment Method'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
} 