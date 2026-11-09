import logger from "../utils/logger";
import { photoSrc } from '../utils/photoUrl'
import React, { useState, useEffect } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getApiBaseUrl } from '../utils/config'
import { setCookie } from '../utils/cookies'
import { getUniqueDeviceId, detectPlatform } from '../utils/deviceId'
import { AppleFilled } from '@ant-design/icons'
import googlePayButton from '../assets/plain-button-google-pay.png'
import { tipText } from '../utils/firstTip'

// Stripe will be initialized dynamically with the publishable key from backend

/** What a tipper reads when something goes wrong. Always calm, always says nothing was charged, never a server message. */
const MSG_TRY_AGAIN = "We couldn't set up your card just now. Nothing was charged. Please try again in a moment."
const MSG_CONNECTION = "We couldn't reach our payment partner. Please check your connection and try again. Nothing was charged."
const MSG_NOT_SAVED = "We couldn't save your card. Nothing was charged. Please try again."

let stripePromiseCache: Promise<Stripe | null> | null = null

const getOrCreateStripePromise = (): Promise<Stripe | null> => {
  if (stripePromiseCache) {
    return stripePromiseCache
  }

  stripePromiseCache = (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/stripe-config/publishable-key`)
      if (res.ok) {
        const data = await res.json()
        const backendKey = data?.publishableKey
        if (backendKey) {
          return await loadStripe(backendKey)
        }
      }
    } catch {
      // Fall back to env key below
    }

    const fallbackKey = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!fallbackKey) {
      throw new Error('Unable to initialize Stripe: no publishable key available')
    }

    return await loadStripe(fallbackKey)
  })()

  return stripePromiseCache
}

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
  walletMode?: 'wallet' | 'card' | 'both'
  /** The amount the tipper tapped to get here. It is sent as soon as the card is saved. */
  tipAmount?: number | null
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
  performerPhotoUrl,
  walletMode = 'both',
  tipAmount = null
}: PaymentSetupModalProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [photoFailed, setPhotoFailed] = useState(false)

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const promise = getOrCreateStripePromise()
        if (isMounted) setStripePromise(promise)
      } catch (e: any) {
        if (isMounted) {
          setInitError(e?.message || 'Failed to initialize Stripe')
        }
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-lift sm:rounded-2xl">
        {/* ========== PERFORMER HERO SECTION ========== */}
        <div className="bg-gradient-to-b from-brand-50 via-brand-50 to-white px-6 pb-4 pt-6 text-center">
          <div className="flex flex-col items-center space-y-3">
            {performerPhotoUrl && !photoFailed ? (
              <img
                src={photoSrc(performerPhotoUrl)}
                alt=""
                onError={() => setPhotoFailed(true)}
                className="h-16 w-16 rounded-full border-4 border-white object-cover shadow-lg"
              />
            ) : (
              <div aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-brand-100 text-xl font-extrabold text-brand-800 shadow-lg">
                {(performerStageName || performerFirstName || 'T').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold text-ink-900">
                {performerStageName || `${performerFirstName} ${performerLastName}`}
              </h1>
              <p className="text-base font-medium text-brand-800">You're about to light up their stage</p>
            </div>
          </div>
        </div>

        {/* ========== FORM CONTENT ========== */}
        <div className="px-6 pb-6 pt-4">
          {/* The two things a first-time tipper wonders: will I be charged now, and what happens next */}
          <div className="mb-5 rounded-xl bg-brand-50 px-4 py-3 text-[15px] leading-snug text-ink-700">
            <p className="font-semibold text-ink-900">Add a card once. Saving it doesn't charge it.</p>
            <p className="mt-0.5">
              {tipAmount
                ? `Your ${tipText(tipAmount)} tip is sent as soon as it's saved, and charged to this card.`
                : 'After that, one tap on an amount sends your tip, charged to this card.'}
            </p>
          </div>
          {!stripePromise && (
            <div className="text-center py-8">
              <p className="text-sm text-ink-500">Getting things ready…</p>
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
                walletMode={walletMode}
                tipAmount={tipAmount}
                performerName={performerStageName || `${performerFirstName ?? ''} ${performerLastName ?? ''}`.trim()}
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
  onComplete, 
  onClose,
  walletMode,
  tipAmount,
  performerName
}: { 
  deviceUuid: string
  userId: string
  onComplete: (paymentMethodId?: string) => void
  onClose: () => void
  walletMode: 'wallet' | 'card' | 'both'
  tipAmount?: number | null
  performerName?: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentRequest, setPaymentRequest] = useState<any>(null)
  const [isApplePay, setIsApplePay] = useState(false)
  const [isCheckingWalletAvailability, setIsCheckingWalletAvailability] = useState(walletMode !== 'card')

  // Persist payment details to backend so ownership verification passes
  const storePaymentInfo = async (
    persistedUserId: string,
    paymentMethodId?: string,
    stripeCustomerId?: string,
    platform?: string,
    payWallet?: boolean,
    setupIntentId?: string
  ): Promise<boolean> => {
    logger.log('💾 [storePaymentInfo] Called with:', { persistedUserId, paymentMethodId, stripeCustomerId, platform })
    
    if (!paymentMethodId || !stripeCustomerId) {
      logger.warn('⚠️ [storePaymentInfo] Missing paymentMethodId or stripeCustomerId, skipping storage', { 
        paymentMethodId: paymentMethodId ? '✓' : '✗',
        stripeCustomerId: stripeCustomerId ? '✓' : '✗'
      })
      return false
    }

    try {
      logger.log('📤 [storePaymentInfo] Storing payment info to backend...')
      const requestBody = {
        userId: persistedUserId,
        paymentMethodId,
        stripeCustomerId,
        setupIntentId,
        deviceUuid,
        platform: platform || detectPlatform(),
        isPayWallet: payWallet
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
        return true
      }
      logger.error('❌ [storePaymentInfo] Backend returned error:', response.status, response.statusText, 'Body:', responseText)
      return false
    } catch (err) {
      logger.error('❌ [storePaymentInfo] Failed to persist payment info to backend', err)
      return false
    }
  }

  useEffect(() => {
    if (stripe) {
      setIsCheckingWalletAvailability(true)
      // Saving a card charges nothing, so the sheet shows $0 and says what saving it is for
      const totalAmount = 0
      const sheetLabel = tipAmount ? `Save your card to send a ${tipText(tipAmount)} tip` : `Save your card to tip ${performerName || 'your performer'}`
      const baseConfig = {
        country: 'US',
        currency: 'usd',
        total: { label: sheetLabel, amount: totalAmount },
        requestPayerName: true,
        requestPayerEmail: true,
        displayItems: []
      }
      const applePaymentRequest = stripe.paymentRequest(baseConfig)
      const googlePaymentRequest = stripe.paymentRequest({
        ...baseConfig,
        displayItems: [{ label: sheetLabel, amount: totalAmount }]
      })
      
      Promise.all([
        applePaymentRequest.canMakePayment(),
        googlePaymentRequest.canMakePayment()
      ]).then(([appleResult, googleResult]) => {
        logger.log('Payment Request canMakePayment result:', appleResult)
        logger.log('User Agent:', navigator.userAgent)
        logger.log('Platform:', navigator.platform)
        logger.log('Is HTTPS:', window.location.protocol === 'https:')

        const appleAvailable = !!(appleResult && (appleResult as any).applePay)
        const googleAvailable = !!(
          (googleResult && (googleResult as any).googlePay) ||
          (appleResult && (appleResult as any).googlePay)
        )
        const platform = detectPlatform()
        const preferredWallet = platform === 'iOS' && appleAvailable
          ? 'apple'
          : (googleAvailable ? 'google' : (appleAvailable ? 'apple' : null))

        if (preferredWallet) {
          setPaymentRequest(preferredWallet === 'google' ? googlePaymentRequest : applePaymentRequest)
          setIsApplePay(preferredWallet === 'apple')
          logger.log('Payment Request is available - Apple Pay:', appleAvailable, 'Google Pay:', googleAvailable, 'Preferred:', preferredWallet)
        } else {
          setPaymentRequest(null)
          logger.log('Payment Request not available - no Apple Pay or Google Pay support detected')
        }
        setIsCheckingWalletAvailability(false)
      }).catch((error) => {
        logger.error('Payment Request canMakePayment error:', error)
        setPaymentRequest(null)
        setIsCheckingWalletAvailability(false)
      })

      // Handle payment request events
      const attachPaymentHandlers = (request: any) => {
        request.on('paymentmethod', async (event: any) => {
        logger.log('Payment Request paymentmethod event:', event)
        try {
          setLoading(true)
          setError(null)
          
          // Get setup intent from backend
          const res = await fetch(`${getApiBaseUrl()}/api/stripe/setup-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceUuid, userId: getUniqueDeviceId() })
          })
          
          if (!res.ok) {
            event.complete('fail')
            setError(MSG_TRY_AGAIN)
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
            setError(error.message || MSG_TRY_AGAIN)
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
            const stored = await storePaymentInfo(uniqueDeviceId!, paymentMethodId, customerId, platform, true, setupIntent?.id)
            if (!stored) {
              // Don't report success: a card the server didn't save is rejected when the tip is sent
              event.complete('fail')
              setError(MSG_NOT_SAVED)
              return
            }
            
            // Payment method is automatically attached to customer by Stripe during SetupIntent confirmation
            event.complete('success')
            onComplete(paymentMethodId)
          }
        } catch (error) {
          logger.error('Payment Request error:', error)
          event.complete('fail')
          setError(MSG_TRY_AGAIN)
        } finally {
          setLoading(false)
        }
        })

        request.on('cancel', () => {
        logger.log('Payment Request cancelled')
      })
      }

      attachPaymentHandlers(applePaymentRequest)
      attachPaymentHandlers(googlePaymentRequest)
    }
  }, [stripe, deviceUuid, onComplete, tipAmount, performerName])
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
        body: JSON.stringify({ deviceUuid, userId: getUniqueDeviceId() })
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        logger.error('Setup intent error:', errorText)
        setError(MSG_TRY_AGAIN)
        setLoading(false)
        return
      }
      
      const data = await res.json()
      logger.log('Setup intent response:', data)
      
      if (!data.clientSecret) {
        logger.error('Setup intent response had no client secret')
        setError(MSG_TRY_AGAIN)
        setLoading(false)
        return
      }

      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        logger.error('Card input not found')
        setError(MSG_TRY_AGAIN)
        setLoading(false)
        return
      }

      logger.log('Confirming card setup')
      const result = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: cardElement,
        },
      })

      logger.log('Card setup result:', result)
      logger.log('📥 Setup intent response from /api/stripe/setup-intent (card path):', data)
      if (result.error) {
        setError(result.error.message || "That card didn't work. Please check the details or try another card.")
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
        const stored = await storePaymentInfo(uniqueDeviceId!, paymentMethodId, customerId, platform, false, result.setupIntent?.id)
        if (!stored) {
          // Don't report success: a card the server didn't save is rejected when the tip is sent
          setError(MSG_NOT_SAVED)
          return
        }
        
        // Payment method is automatically attached to customer by Stripe during SetupIntent confirmation
        onComplete(paymentMethodId)
      }
    } catch (error) {
      logger.error('Card submission error:', error)
      setError(MSG_CONNECTION)
    } finally {
      setLoading(false)
    }
  }

  const isWalletOnly = walletMode === 'wallet'
  const [showCardFields, setShowCardFields] = useState(false)

  return (
    <form onSubmit={isWalletOnly || !showCardFields ? undefined : handleCardSubmit} className="space-y-0">
      {/* ========== SECTION 1: DIGITAL WALLETS ========== */}
      {walletMode !== 'card' && (
        <div className="pb-4">
          {(isCheckingWalletAvailability || !stripe) && (
            <button
              type="button"
              disabled
              className="w-full min-h-[44px] transition-all disabled:opacity-70 font-medium text-base flex items-center justify-center bg-transparent p-0"
              aria-label="Loading Pay Wallet"
            >
              <img
                src={googlePayButton}
                alt="Pay Wallet"
                className="h-12 w-auto opacity-80"
              />
            </button>
          )}

          {!isCheckingWalletAvailability && stripe && paymentRequest && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                paymentRequest.show()
              }}
              disabled={loading}
              className={`w-full min-h-[44px] transition-all disabled:opacity-50 font-medium text-base flex items-center justify-center ${
                isApplePay
                  ? 'bg-black text-white py-3 px-6 rounded-full hover:bg-slate-800 active:bg-slate-900'
                  : 'bg-transparent p-0'
              }`}
            >
              {isApplePay ? (
                <>
                  <span className="text-lg">Pay with</span>
                  <AppleFilled style={{ fontSize: '28px' }} />
                  <span className="text-lg">Pay</span>
                </>
              ) : (
                <img
                  src={googlePayButton}
                  alt="Google Pay"
                  className="h-12 w-auto"
                />
              )}
            </button>
          )}

        </div>
      )}

      {/* Secondary card action */}
      {walletMode !== 'wallet' && !showCardFields && (
        <div className="pb-6">
          <button
            type="button"
            onClick={() => setShowCardFields(true)}
            className="w-full min-h-[44px] border border-slate-300 text-ink-700 bg-white rounded-xl px-4 py-3 hover:bg-surface active:bg-slate-100 transition-all font-medium text-base"
          >
            Use a card
          </button>
        </div>
      )}

      {/* ========== SECTION 2: MANUAL CARD ENTRY ========== */}
      {walletMode !== 'wallet' && (
        <div
          className={`pb-6 transition-all duration-200 ${
            showCardFields ? 'opacity-100 max-h-[800px]' : 'opacity-0 max-h-0 overflow-hidden'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-semibold text-ink-900">Card details</label>
          </div>
          
          <div className="border-2 border-slate-200 rounded-lg p-4 bg-white hover:border-slate-300 focus-within:border-brand-600 transition-colors">
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

          <button
            type="submit"
            disabled={loading || !stripe || !showCardFields}
            className="mt-4 w-full bg-brand-700 text-white py-4 px-4 rounded-xl hover:bg-brand-800 active:bg-brand-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
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
              'Save my card'
            )}
          </button>
        </div>
      )}

      {/* ========== ERROR MESSAGE ========== */}
      {error && (
        <div className="mb-6 text-red-600 text-sm bg-red-50 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* ========== SECTION 3: ACTION BUTTONS ========== */}
      <div className="pb-6 border-b border-slate-200 space-y-3">
        {isWalletOnly && (
          <button
            type="button"
            onClick={() => {
              if (paymentRequest) {
                paymentRequest.show()
              } else {
                setError("Apple Pay or Google Pay isn't available on this device. You can use a card instead.")
              }
            }}
            disabled={loading || !stripe || !paymentRequest}
            className="w-full bg-brand-700 text-white py-4 px-4 rounded-xl hover:bg-brand-800 active:bg-brand-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
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
              'Activate Pay Wallet'
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="w-full text-ink-500 py-3 px-4 rounded-xl hover:text-ink-900 hover:bg-surface transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base"
        >
          Not now
        </button>
      </div>

      {/* ========== SECTION 4: WHY THIS IS SAFE ========== */}
      <div className="space-y-1.5 pt-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="text-sm font-semibold text-ink-700">Your card goes straight to Stripe</p>
        </div>
        <p className="px-2 text-[13px] leading-relaxed text-ink-500">Stripe is the payment company that handles it. Tipwave never sees your card number.</p>
      </div>
    </form>
  )
} 