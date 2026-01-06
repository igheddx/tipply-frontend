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
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Add Payment Method</h2>
        <p className="text-gray-600 mb-6">
          To start tipping performers, please add a payment method below.
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
          console.log('📥 Setup intent response from /api/stripe/setup-intent:', data)
          
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
            // Extract payment method ID from the SetupIntent, NOT the event
            const paymentMethodId = setupIntent?.payment_method as string
            console.log('💳 Payment method ID from wallet:', paymentMethodId)
            
            // Store setup success in localStorage
            const tempUserId = localStorage.getItem('tipply_user_id')
            const customerId = data.customerId
            console.log('🔍 Debug - customerId from response:', customerId, 'tempUserId:', tempUserId)
            if (tempUserId && customerId) {
              localStorage.setItem(`stripe_customer_id_${tempUserId}`, customerId)
              console.log('💾 Stored Stripe customer ID:', customerId)
              localStorage.setItem(`payment_status_${tempUserId}_${deviceUuid}`, JSON.stringify({
                hasPaymentMethods: true,
                paymentMethodType: 'card'
              }))
              localStorage.setItem(`payment_status_timestamp_${tempUserId}_${deviceUuid}`, Date.now().toString())
              
              // Store payment method ID directly here too
              if (paymentMethodId) {
                localStorage.setItem(`payment_method_id_${tempUserId}`, paymentMethodId)
                localStorage.setItem(`payment_method_timestamp_${tempUserId}`, Date.now().toString())
                console.log('💾 Stored payment method ID:', paymentMethodId)
              }
            }
            
            // Payment method is automatically attached to customer by Stripe during SetupIntent confirmation
            event.complete('success')
            toast.success('Payment method added successfully!')
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
      console.log('📥 Setup intent response from /api/stripe/setup-intent (card path):', data)
      if (result.error) {
        setError(result.error.message || 'Card error')
      } else {
        console.log('Payment method setup successful:', result.setupIntent)
        // Extract payment method ID from the setup intent
        const paymentMethodId = result.setupIntent?.payment_method as string | undefined
        console.log('💳 Payment method ID from card:', paymentMethodId)
        
        // Store setup success in localStorage, including the customer ID returned from backend
        const tempUserId = localStorage.getItem('tipply_user_id')
        const customerId = data.customerId
        console.log('🔍 Debug - customerId from response (card):', customerId, 'tempUserId:', tempUserId)
        if (tempUserId && customerId) {
          localStorage.setItem(`stripe_customer_id_${tempUserId}`, customerId)
          console.log('💾 Stored Stripe customer ID:', customerId)
          localStorage.setItem(`payment_status_${tempUserId}_${deviceUuid}`, JSON.stringify({
            hasPaymentMethods: true,
            paymentMethodType: 'card'
          }))
          localStorage.setItem(`payment_status_timestamp_${tempUserId}_${deviceUuid}`, Date.now().toString())
          
          // Store payment method ID directly here too
          if (paymentMethodId) {
            localStorage.setItem(`payment_method_id_${tempUserId}`, paymentMethodId)
            localStorage.setItem(`payment_method_timestamp_${tempUserId}`, Date.now().toString())
            console.log('💾 Stored payment method ID:', paymentMethodId)
          }
        }
        
        // Payment method is automatically attached to customer by Stripe during SetupIntent confirmation
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
        <>
          <div className="mb-4">
            <button
              onClick={() => paymentRequest.show()}
              disabled={loading}
              className="w-full bg-black text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium"
            >
              {isApplePay ? '🍎 Pay with Apple Pay' : '📱 Pay with Google Pay'}
            </button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or add a card</span>
            </div>
          </div>
        </>
      ) : null}

      <form onSubmit={handleCardSubmit} className="space-y-4">
        <div className="border rounded-lg p-3 bg-gray-50">
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
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? 'Processing...' : 'Add Payment Method'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        
        {/* Security Reassurance with Stripe Logo */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex flex-col items-center text-center space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              Payments are securely processed by Stripe. Your card details are encrypted and never stored on your device.
            </p>
            <svg
              role="img"
              aria-label="Stripe"
              viewBox="0 0 60 25"
              className="w-16 h-auto opacity-80"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Stripe</title>
              <path
                fill="#6772e5"
                d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 8.95c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.88zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-13.17 4.02-.86v3.54h3.14V9.1h-3.13v5.85zm-4.91.70c0 2.97-2.31 4.66-5.73 4.66a11.2 11.2 0 0 1-4.46-.93v-3.93c1.38.75 3.10 1.31 4.46 1.31.92 0 1.53-.24 1.53-1C6.26 13.77 0 14.51 0 9.95 0 7.04 2.28 5.3 5.62 5.3c1.36 0 2.72.2 4.09.75v3.88a9.23 9.23 0 0 0-4.1-1.06c-.86 0-1.44.25-1.44.93 0 1.85 6.29.97 6.29 5.88z"
              />
            </svg>
          </div>
        </div>
      </form>
    </div>
  )
} 