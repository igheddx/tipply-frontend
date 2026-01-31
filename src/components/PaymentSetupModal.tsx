import logger from "../utils/logger";
import React, { useState, useEffect } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { toast } from 'sonner'
import { getApiBaseUrl } from '../utils/config'
import { setCookie } from '../utils/cookies'
import { getUniqueDeviceId, detectPlatform } from '../utils/deviceId'
import { AppleFilled } from '@ant-design/icons'

// Stripe will be initialized dynamically with the publishable key from backend

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
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        // Fetch active publishable key from backend (respects live/test mode)
        const res = await fetch(`${getApiBaseUrl()}/api/stripe-config/publishable-key`)
        if (!res.ok) {
          // Fallback to env var if endpoint fails
          const fallbackKey = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY
          if (!fallbackKey) {
            setInitError('Unable to initialize Stripe: missing publishable key')
            return
          }
          const promise = loadStripe(fallbackKey)
          if (isMounted) setStripePromise(promise)
          return
        }
        const data = await res.json()
        const key = data?.publishableKey || (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY
        if (!key) {
          setInitError('Unable to initialize Stripe: no publishable key available')
          return
        }
        const promise = loadStripe(key)
        if (isMounted) setStripePromise(promise)
      } catch (e) {
        const fallbackKey = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY
        if (fallbackKey) {
          const promise = loadStripe(fallbackKey)
          if (isMounted) setStripePromise(promise)
        } else {
          setInitError('Failed to initialize Stripe')
        }
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* ========== PERFORMER HERO SECTION ========== */}
        <div className="bg-gradient-to-b from-purple-50 via-blue-50 to-white px-6 pt-10 pb-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            {performerPhotoUrl && (
              <img
                src={performerPhotoUrl}
                alt="Performer"
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            )}
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-gray-900">
                {performerStageName || `${performerFirstName} ${performerLastName}`}
              </h1>
              <p className="text-base text-purple-700 font-medium">
                You're about to light up their stage ✨
              </p>
            </div>
          </div>
        </div>

        {/* ========== FORM CONTENT ========== */}
        <div className="px-6 py-8">
          {!stripePromise && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">Initializing secure payment...</p>
              {initError && (
                <p className="mt-2 text-sm text-red-600">{initError}</p>
              )}
            </div>
          )}
          {stripePromise && (
            <Elements stripe={stripePromise}>
              <PaymentForm 
                deviceUuid={deviceUuid}
                userId={userId}
                onComplete={onComplete}
                onClose={onClose}
              />
            </Elements>
          )}
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
  const [isApplePay, setIsApplePay] = useState(false)

  // Persist payment details to backend so ownership verification passes
  const storePaymentInfo = async (persistedUserId: string, paymentMethodId?: string, stripeCustomerId?: string, platform?: string) => {
    logger.log('💾 [storePaymentInfo] Called with:', { persistedUserId, paymentMethodId, stripeCustomerId, platform })
    
    if (!paymentMethodId || !stripeCustomerId) {
      logger.warn('⚠️ [storePaymentInfo] Missing paymentMethodId or stripeCustomerId, skipping storage', { 
        paymentMethodId: paymentMethodId ? '✓' : '✗',
        stripeCustomerId: stripeCustomerId ? '✓' : '✗'
      })
      return
    }

    try {
      logger.log('📤 [storePaymentInfo] Storing payment info to backend...')
      const requestBody = {
        userId: persistedUserId,
        paymentMethodId,
        stripeCustomerId,
        platform: platform || detectPlatform()
      }
      logger.log('📤 [storePaymentInfo] Request body:', requestBody)
      
      const response = await fetch(`${getApiBaseUrl()}/api/stripe/store-payment-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      
      const responseText = await response.text()
      logger.log('📥 [storePaymentInfo] Response status:', response.status, 'Body:', responseText)
      
      if (response.ok) {
        logger.log('✅ [storePaymentInfo] Payment info stored successfully')
      } else {
        logger.error('❌ [storePaymentInfo] Backend returned error:', response.status, response.statusText, 'Body:', responseText)
      }
    } catch (err) {
      logger.error('❌ [storePaymentInfo] Failed to persist payment info to backend', err)
    }
  }

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
        logger.log('Payment Request canMakePayment result:', result)
        logger.log('User Agent:', navigator.userAgent)
        logger.log('Platform:', navigator.platform)
        logger.log('Is HTTPS:', window.location.protocol === 'https:')

        const appleAvailable = !!(result && (result as any).applePay)
        const googleAvailable = !!(result && (result as any).googlePay)

        if (appleAvailable || googleAvailable) {
          setPaymentRequest(pr)
          setIsApplePay(appleAvailable)
          logger.log('Payment Request is available - Apple Pay:', appleAvailable, 'Google Pay:', googleAvailable)
        } else {
          logger.log('Payment Request not available - no Apple Pay or Google Pay support detected')
        }
      }).catch((error) => {
        logger.error('Payment Request canMakePayment error:', error)
      })

      // Handle payment request events
      pr.on('paymentmethod', async (event) => {
        logger.log('Payment Request paymentmethod event:', event)
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
          logger.log('📥 Setup intent response from /api/stripe/setup-intent:', data)
          
          // Confirm the setup intent with the payment method
          const { error, setupIntent } = await stripe.confirmCardSetup(data.clientSecret, {
            payment_method: event.paymentMethod.id,
          })
          
          if (error) {
            logger.error('Payment Request setup error:', error)
            event.complete('fail')
            setError(error.message || 'Payment setup failed')
          } else {
            logger.log('Payment Request setup successful:', setupIntent)
            // Extract payment method ID from the SetupIntent, NOT the event
            const paymentMethodId = setupIntent?.payment_method as string
            logger.log('💳 Payment method ID from wallet:', paymentMethodId)
            
            // Get unique device ID
            const uniqueDeviceId = getUniqueDeviceId()
            const platform = detectPlatform()
            const customerId = data.customerId
            logger.log('🔍 [ApplePay] Using uniqueDeviceId:', uniqueDeviceId, 'customerId:', customerId, 'platform:', platform)
            if (customerId) {
              localStorage.setItem(`stripe_customer_id_${uniqueDeviceId}`, customerId)
              setCookie(`stripe_customer_id_${uniqueDeviceId}`, customerId, 60)
              logger.log('💾 Stored Stripe customer ID:', customerId)
              localStorage.setItem(`payment_status_${uniqueDeviceId}_${deviceUuid}`, JSON.stringify({
                hasPaymentMethods: true,
                paymentMethodType: 'card'
              }))
              localStorage.setItem(`payment_status_timestamp_${uniqueDeviceId}_${deviceUuid}`, Date.now().toString())
              
              // Store payment method ID directly here too
              if (paymentMethodId) {
                localStorage.setItem(`payment_method_id_${uniqueDeviceId}`, paymentMethodId)
                localStorage.setItem(`payment_method_timestamp_${uniqueDeviceId}`, Date.now().toString())
                // Keep payment method id cookie for resilience (non-sensitive, still scoped to app domain)
                setCookie(`payment_method_id_${uniqueDeviceId}`, paymentMethodId, 60)
                logger.log('💾 Stored payment method ID:', paymentMethodId)
              }
            }
            // Persist payment info to backend so security checks pass
            await storePaymentInfo(uniqueDeviceId!, paymentMethodId, customerId, platform)
            
            // Payment method is automatically attached to customer by Stripe during SetupIntent confirmation
            event.complete('success')
            toast.success('Payment method added successfully!')
            onComplete(paymentMethodId)
          }
        } catch (error) {
          logger.error('Payment Request error:', error)
          event.complete('fail')
          setError('Payment setup failed')
        } finally {
          setLoading(false)
        }
      })

      pr.on('cancel', () => {
        logger.log('Payment Request cancelled')
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
        logger.error('Setup intent error:', errorText)
        setError(`Server error: ${res.status} - ${errorText}`)
        setLoading(false)
        return
      }
      
      const data = await res.json()
      logger.log('Setup intent response:', data)
      
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

      logger.log('Confirming card setup with client secret:', data.clientSecret)
      const result = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: cardElement,
        },
      })

      logger.log('Card setup result:', result)
      logger.log('📥 Setup intent response from /api/stripe/setup-intent (card path):', data)
      if (result.error) {
        setError(result.error.message || 'Card error')
      } else {
        logger.log('Payment method setup successful:', result.setupIntent)
        // Extract payment method ID from the setup intent
        const paymentMethodId = result.setupIntent?.payment_method as string | undefined
        logger.log('💳 Payment method ID from card:', paymentMethodId)
        
        // Get unique device ID
        const uniqueDeviceId = getUniqueDeviceId()
        const platform = detectPlatform()
        const customerId = data.customerId
        logger.log('🔍 [CardSubmit] Using uniqueDeviceId:', uniqueDeviceId, 'customerId:', customerId, 'platform:', platform)
        if (customerId) {
          localStorage.setItem(`stripe_customer_id_${uniqueDeviceId}`, customerId)
          setCookie(`stripe_customer_id_${uniqueDeviceId}`, customerId, 60)
          logger.log('💾 Stored Stripe customer ID:', customerId)
          localStorage.setItem(`payment_status_${uniqueDeviceId}_${deviceUuid}`, JSON.stringify({
            hasPaymentMethods: true,
            paymentMethodType: 'card'
          }))
          localStorage.setItem(`payment_status_timestamp_${uniqueDeviceId}_${deviceUuid}`, Date.now().toString())
          
          // Store payment method ID directly here too
          if (paymentMethodId) {
            localStorage.setItem(`payment_method_id_${uniqueDeviceId}`, paymentMethodId)
            localStorage.setItem(`payment_method_timestamp_${uniqueDeviceId}`, Date.now().toString())
            setCookie(`payment_method_id_${uniqueDeviceId}`, paymentMethodId, 60)
            logger.log('💾 Stored payment method ID:', paymentMethodId)
          }
        }
        // Persist payment info to backend so security checks pass
        await storePaymentInfo(uniqueDeviceId!, paymentMethodId, customerId, platform)
        
        // Payment method is automatically attached to customer by Stripe during SetupIntent confirmation
        toast.success('Payment method added successfully!')
        onComplete(paymentMethodId)
      }
    } catch (error) {
      logger.error('Card submission error:', error)
      setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleCardSubmit} className="space-y-0">
      {/* ========== SECTION 1: DIGITAL WALLETS ========== */}
      {paymentRequest && (
        <div className="pb-6 border-b border-gray-200">
          <button
            onClick={() => paymentRequest.show()}
            disabled={loading}
            className="w-full bg-black text-white py-3 px-6 rounded-full hover:bg-gray-800 active:bg-gray-900 transition-all disabled:opacity-50 font-medium text-base flex items-center justify-center gap-2"
          >
            {isApplePay ? (
              <>
                <span>Pay with</span>
                <AppleFilled style={{ fontSize: '20px' }} />
                <span>Pay</span>
              </>
            ) : (
              <img
                src="/images/plain-button-google-pay.png"
                alt="Google Pay"
                className="h-6 w-auto"
              />
            )}
          </button>
          
          {/* Subtle Divider */}
          <div className="mt-6 mb-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Or</p>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>
      )}

      {/* ========== SECTION 2: MANUAL CARD ENTRY ========== */}
      <div className="pb-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-semibold text-gray-900">Card Details</label>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              // TODO: Implement autofill from browser
            }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Autofill
          </a>
        </div>
        
        <div className="border-2 border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 focus-within:border-blue-500 transition-colors">
          <CardElement 
            options={{ 
              style: { 
                base: { 
                  fontSize: '16px',
                  color: '#1f2937',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  '::placeholder': {
                    color: '#9ca3af',
                  },
                },
                invalid: {
                  color: '#dc2626',
                },
              },
            }} 
          />
        </div>
      </div>

      {/* ========== ERROR MESSAGE ========== */}
      {error && (
        <div className="mb-6 text-red-600 text-sm bg-red-50 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* ========== SECTION 3: ACTION BUTTONS ========== */}
      <div className="pb-6 border-b border-gray-200 space-y-3">
        <button
          type="submit"
          disabled={loading || !stripe}
          className="w-full bg-blue-600 text-white py-4 px-4 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing...</span>
            </span>
          ) : (
            'Add Payment Method'
          )}
        </button>
        
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="w-full text-gray-600 py-3 px-4 rounded-xl hover:text-gray-900 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base"
        >
          Cancel
        </button>
      </div>

      {/* ========== SECTION 4: SECURITY REASSURANCE ========== */}
      <div className="pt-4 text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <svg
            className="w-4 h-4 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="text-xs text-gray-500 font-medium">
            Securely processed by Stripe
          </p>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed px-2">
          Your card details are encrypted and never stored on your device.
        </p>
      </div>
    </form>
  )
} 