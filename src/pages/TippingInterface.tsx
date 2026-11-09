import logger from "../utils/logger";
import { tipHaptic, prepareHaptics } from '../utils/haptics'
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import apiService from '../services/api'
import { getApiBaseUrl } from '../utils/config'
import { TipperRefundNotice } from '../components/tip/TipperRefundNotice'
import { FeedbackBar } from '../components/tip/FeedbackBar'
import { FeedbackFormModal } from '../components/tip/FeedbackFormModal'
import { GiveFeedbackLink } from '../components/tip/GiveFeedbackLink'
import { useFeedbackPrompt } from '../hooks/useFeedbackPrompt'
import { DEFAULT_TIP_AMOUNTS, TIP_AMOUNT_COUNT } from '../utils/deviceConfig'
import { getUniqueDeviceId, detectPlatform, initDeviceId } from '../utils/deviceId'
import { TipScreen } from '../components/tip/TipScreen'
import { SongPickerSheet, type PickedSong } from '../components/tip/SongPickerSheet'
import { BrandIcon, type BrandIconName } from '../components/icons/BrandIcons'
import { Button } from '../components/ui'
import { APP_VERSION } from '../utils/appVersion'
import { tipGradient, tipPalette } from '../utils/tipTheme'
import { TestSiteStrip } from '../components/tip/TestSiteStrip'

const PaymentSetupModal = lazy(() => import('../components/PaymentSetupModal'))

let confettiLoader: any = null

interface DeviceInfo {
  id: string
  uuid: string
  ownerFirstName: string
  ownerLastName: string
    stageName?: string
  profilePhotoUrl?: string
  bio?: string
  songCount?: number
  ownerId: string
  stripeAccountId?: string
  isAllowSongRequest?: boolean
  tipAmounts?: number[]
  // Venue devices: who is on, and the session the page must send back with a tip
  isVenueDevice?: boolean
  venueName?: string
  sessionId?: string
  noActivePerformer?: boolean
  performerMismatch?: boolean
  expectedPerformerName?: string
}

interface PaymentMethodsCheckResult {
  hasPaymentMethods: boolean
  paymentMethodType?: string
  paymentMethodId?: string
  cardBrand?: string
  cardLast4?: string
}

function InfoScreen({
  icon,
  title,
  children,
  action,
  feedback
}: {
  icon: BrandIconName
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  /** Lets anyone, even without a tip, tell us how it went */
  feedback?: { userId: string; deviceUuid?: string }
}) {
  const palette = tipPalette(APP_VERSION)
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6 text-white"
      style={{ height: '100dvh', background: tipGradient(palette) }}
    >
      {palette.test && <TestSiteStrip className="absolute inset-x-6 top-4" />}
      <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-8 text-center backdrop-blur-md">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
          <BrandIcon name={icon} size={30} tone="inverse" />
        </span>
        <h2 className="mt-5 text-2xl font-bold">{title}</h2>
        <p className="mt-3 text-white/80">{children}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
      {feedback && (
        <div className="absolute inset-x-0 bottom-4 text-center">
          <GiveFeedbackLink userId={feedback.userId} deviceUuid={feedback.deviceUuid} />
        </div>
      )}
    </div>
  )
}

const TippingInterface: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>()
  const [totalTipped, setTotalTipped] = useState<number>(0)
  const [isDebouncing, setIsDebouncing] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isPaymentSetup, setIsPaymentSetup] = useState(false)
  
  const [userId, setUserId] = useState<string>('')
  const [checkingPaymentMethods, setCheckingPaymentMethods] = useState(true)
  const [isDeviceVerified, setIsDeviceVerified] = useState<boolean | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(false)
  // The amount tapped most recently: its button shows "Sent" for a moment
  const [sentAmount, setSentAmount] = useState<number | null>(null)
  // The song that was just sent with a tip, shown as "Request sent" for a few seconds
  const [sentSong, setSentSong] = useState<{ title: string; artist: string } | null>(null)
  const sentSongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A short, optional question after a tip goes through; the server decides whether to ask at all
  const feedback = useFeedbackPrompt(userId, deviceInfo?.uuid)
  const songPickerUsed = useRef(false)
  const [savedCard, setSavedCard] = useState<{ brand?: string; last4?: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isPortrait, setIsPortrait] = useState(true)
  
  // Song request state
  const [showSongSearch, setShowSongSearch] = useState(false)
  const [selectedSong, setSelectedSong] = useState<{id: string, title: string, artist: string} | null>(null)
  const [songRequestName, setSongRequestName] = useState('')
  const [songRequestNote, setSongRequestNote] = useState('')
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Tip amounts for the cards: the performer's own six amounts (defaults until they change them)
  const tipAmounts = deviceInfo?.tipAmounts?.length === TIP_AMOUNT_COUNT ? deviceInfo.tipAmounts : DEFAULT_TIP_AMOUNTS

  // Manage body overflow
  // Have the iPhone haptic switch ready before the first tap
  useEffect(() => {
    prepareHaptics()
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Lock UI to portrait for both iOS and Android
  useEffect(() => {
    // Attempt to lock orientation using Screen Orientation API (primary method)
    const lockOrientation = async () => {
      try {
        const screenOrientation = screen.orientation as any
        if (screenOrientation && screenOrientation.lock) {
          await screenOrientation.lock('portrait-primary').catch((error: Error) => {
            logger.warn('Failed to lock to portrait-primary, trying portrait:', error)
            // Fallback to generic portrait if portrait-primary fails
            return screenOrientation.lock('portrait')
          })
          logger.log('✅ Screen orientation locked to portrait')
        }
      } catch (error) {
        logger.log('📱 Screen Orientation API not available, using CSS fallback:', error)
      }
    }

    // Lock orientation on component mount
    lockOrientation()

    const updateOrientation = () => {
      const portrait = window.matchMedia('(orientation: portrait)').matches || window.innerHeight >= window.innerWidth
      setIsPortrait(portrait)
      
      // CSS-based fallback for browsers without Screen Orientation API support
      if (!portrait && window.innerWidth < 768) {
        logger.log('📱 Landscape detected on mobile - applying CSS rotation lock')
        document.body.style.transform = 'rotate(-90deg)'
        document.body.style.transformOrigin = 'center center'
        document.body.style.width = '100vh'
        document.body.style.height = '100vw'
        document.body.style.overflow = 'hidden'
        document.body.style.position = 'fixed'
      } else {
        // Remove forced rotation
        document.body.style.transform = ''
        document.body.style.transformOrigin = ''
        document.body.style.width = ''
        document.body.style.height = ''
        document.body.style.overflow = ''
        document.body.style.position = ''
      }
    }

    updateOrientation()

    const mq = window.matchMedia('(orientation: portrait)')
    const handler = () => updateOrientation()

    mq.addEventListener('change', handler)
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)

    return () => {
      mq.removeEventListener('change', handler)
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
      
      // Unlock orientation when component unmounts (cleanup)
      try {
        const screenOrientation = screen.orientation as any
        if (screenOrientation && screenOrientation.unlock) {
          screenOrientation.unlock()
          logger.log('🔓 Screen orientation unlocked on component unmount')
        }
      } catch (error) {
        logger.log('Could not unlock orientation:', error)
      }
    }
  }, [])

  // Initialize user
  useEffect(() => {
    const initializeUser = async () => {
      // One device ID for the whole page: taken from localStorage straight away, or (first visit / cleared site
      // data) from IndexedDB for at most 1.5 seconds, otherwise newly generated. It never changes afterwards.
      const uniqueDeviceId = await initDeviceId()
      logger.log('🔐 [Init] Unique device ID:', uniqueDeviceId)
      
      // Detect platform (iOS, Android, Desktop)
      const platform = detectPlatform()
      logger.log('📱 [Init] Platform detected:', platform)
      
      setUserId(uniqueDeviceId)

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/songcatalog/user/${uniqueDeviceId}`)
        if (response.ok) {
          await response.json() // consume body (not used)
        }
        logger.log('👤 [Init] User initialized with ID:', uniqueDeviceId)
      } catch (error) {
        logger.log('Song catalog initialization error:', error)
        logger.log('👤 [Init] User initialized (with error) with ID:', uniqueDeviceId, error)
      }
      
      // Load user's total tips (last 24 hours)
      await loadUserTotal(uniqueDeviceId)
    }

    initializeUser()
  }, [])

    // Load user's total tips from backend (last 24 hours)
    const loadUserTotal = async (userTempId?: string) => {
      try {
        const tempUserId = userTempId || localStorage.getItem('unique_device_id')
        logger.log('🔍 [loadUserTotal] Fetching totals for userId:', tempUserId)
        if (!tempUserId) {
          logger.error('❌ [loadUserTotal] No tempUserId found')
          return false
        }
      
        const url = `${getApiBaseUrl()}/api/tips/user-total/${tempUserId}?tzOffsetMinutes=${new Date().getTimezoneOffset()}`
        logger.log('📡 [loadUserTotal] Request URL:', url)
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
        logger.log('📡 [loadUserTotal] Response status:', response.status)
        if (response.ok) {
          const data = await response.json()
          logger.log('✅ [loadUserTotal] Backend returned:', data)
          logger.log('✅ [loadUserTotal] Setting totalTipped to:', data.totalAmount)
          setTotalTipped(data.totalAmount)
          return true
        } else {
          const errorText = await response.text()
          logger.error('[loadUserTotal] Failed response:', response.status, response.statusText, errorText)
          return false
        }
      } catch (error) {
        logger.error('❌ [loadUserTotal] Error:', error)
        return false
      }
    }

  // Enable audio
  const enableAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      
      if (audioRef.current) {
        audioRef.current.volume = 0
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          await playPromise
        }
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.volume = 1
        setAudioEnabled(true)
      }
    } catch (error) {
      logger.log('Audio enable failed:', error)
    }
  }

  // On a venue's device the performer can change while this page is open. Keep watching, and reload when it does,
  // so the tipper always sees (and pays) whoever is really on the device.
  const venueWatch = deviceInfo?.isVenueDevice ? `${deviceInfo.sessionId ?? ''}|${deviceInfo.noActivePerformer ? 1 : 0}|${deviceInfo.performerMismatch ? 1 : 0}` : null
  useEffect(() => {
    if (!deviceId || venueWatch === null) return
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const p = new URLSearchParams(window.location.search).get('p')
        const r = await fetch(`${getApiBaseUrl()}/api/devices/${deviceId}/public${p ? `?performerId=${encodeURIComponent(p)}` : ''}`)
        if (!r.ok) return
        const d = await r.json()
        const now = `${d.sessionId ?? ''}|${d.noActivePerformer ? 1 : 0}|${d.performerMismatch ? 1 : 0}`
        if (now !== venueWatch) {
          toast.message('The performer on this device changed. Updating…')
          setTimeout(() => window.location.reload(), 1200)
        }
      } catch {
        /* try again next time */
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [deviceId, venueWatch])

  // Fetch device info and check payment methods
  useEffect(() => {
    const fetchDeviceData = async () => {
      if (!deviceId) return
      
      try {
        // A poster printed for one performer carries their id (?p=...), so a different performer is never paid by mistake
        const expectedPerformer = new URLSearchParams(window.location.search).get('p')
        const deviceResponse = await fetch(
          `${getApiBaseUrl()}/api/devices/${deviceId}/public${expectedPerformer ? `?performerId=${encodeURIComponent(expectedPerformer)}` : ''}`
        )
        if (!deviceResponse.ok) {
          toast.error('Device not found')
          return
        }
        
        const device = await deviceResponse.json()

        // A venue device with nobody on it, or a poster for a performer who is not the one on it: no tipping
        if (device.noActivePerformer || device.performerMismatch) {
          setDeviceInfo({
            id: device.id,
            uuid: device.uuid,
            ownerFirstName: '',
            ownerLastName: '',
            ownerId: device.id,
            isVenueDevice: true,
            venueName: device.venueName,
            noActivePerformer: !!device.noActivePerformer,
            performerMismatch: !!device.performerMismatch,
            expectedPerformerName: device.expectedPerformerName
          })
          setCheckingPaymentMethods(false)
          return
        }

        const deviceInfoData = {
          id: device.id,
          uuid: device.uuid,
          ownerFirstName: device.ownerFirstName,
          ownerLastName: device.ownerLastName,
            stageName: device.stageName,
          profilePhotoUrl: device.profilePhotoUrl,
          bio: device.bio,
          songCount: device.songCount,
          ownerId: device.id, // Using device.id since profileId is not exposed in public endpoint
          stripeAccountId: '', // Not exposed in public endpoint
          isAllowSongRequest: device.isAllowSongRequest,
          isStripeVerified: device.isStripeVerified || false,
          isKycVerified: device.isKycVerified || false,
          tipAmounts: device.tipAmounts,
          isVenueDevice: !!device.isVenueDevice,
          venueName: device.venueName || undefined,
          sessionId: device.sessionId || undefined
        }
        setDeviceInfo(deviceInfoData)
        
        // Check if device is verified (both Stripe and KYC)
        const verified = device.isStripeVerified && device.isKycVerified
        setIsDeviceVerified(verified)
        
        // If not verified, don't proceed with payment setup checks
        if (!verified) {
          setCheckingPaymentMethods(false)
          return
        }

        // Check AWS IoT status in background (non-blocking for tip UI readiness)
        void apiService.getAwsIotStatus()
          .then((response) => logger.log('AWS IoT Status:', response))
          .catch((error) => logger.log('AWS IoT Status check failed:', error))

        // Check payment methods using the device UUID
        const paymentCheck = await checkPaymentMethods(deviceInfoData)
        setIsPaymentSetup(paymentCheck.hasPaymentMethods)
        if (paymentCheck.hasPaymentMethods) {
          setSavedCard({ brand: paymentCheck.cardBrand, last4: paymentCheck.cardLast4 })
        }
        if (!paymentCheck.hasPaymentMethods) {
          setShowPaymentModal(true)
        }
        setCheckingPaymentMethods(false)

      } catch (error) {
        logger.error('Error fetching device data:', error)
        toast.error('Failed to load device information')
        setCheckingPaymentMethods(false)
      }
    }

    fetchDeviceData()
  }, [deviceId])

  const checkPaymentMethods = async (deviceInfo?: DeviceInfo | null): Promise<PaymentMethodsCheckResult> => {
    const uniqueDeviceId = getUniqueDeviceId()
    logger.log('🔍 [Payment Check] Starting check - UniqueDeviceId:', uniqueDeviceId, 'DeviceId:', deviceId)
    
    if (!uniqueDeviceId || !deviceId) {
      logger.log('❌ [Payment Check] Missing uniqueDeviceId or deviceId')
      return { hasPaymentMethods: false }
    }

    // First, check if we have a stored payment method ID (30-day memory)
    const storedPaymentMethodId = getStoredPaymentMethodId()
    logger.log('💾 [Payment Check] Stored payment method ID:', storedPaymentMethodId || 'None')

    // Check cached payment status first (valid for 7 days) - only if no stored payment method ID
    if (!storedPaymentMethodId) {
      const cachedPaymentStatus = localStorage.getItem(`payment_status_${uniqueDeviceId}_${deviceId}`)
      const cachedTimestamp = localStorage.getItem(`payment_status_timestamp_${uniqueDeviceId}_${deviceId}`)
      
      if (cachedPaymentStatus && cachedTimestamp) {
        const now = Date.now()
        const cacheAge = now - parseInt(cachedTimestamp)
        const sevenDays = 7 * 24 * 60 * 60 * 1000
        
        if (cacheAge < sevenDays) {
          const cached = JSON.parse(cachedPaymentStatus)
          logger.log('Using cached payment status:', cached)
          return cached
        }
      }
    }

    try {
      const requestBody = {
        deviceUuid: deviceInfo?.uuid || deviceId,
        userId: uniqueDeviceId,
        paymentMethodId: storedPaymentMethodId || undefined
      }
      logger.log('📡 [Payment Check] API request:', requestBody)
      
      const response = await fetch(`${getApiBaseUrl()}/api/stripe/check-payment-methods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      const data = await response.json()
      logger.log('📥 [Payment Check] API response:', data)
      
      if (response.ok && data.hasPaymentMethods) {
        logger.log('✅ [Payment Check] Payment methods found!')
        const result = {
          hasPaymentMethods: true,
          paymentMethodType: data.paymentMethodType,
          paymentMethodId: data.paymentMethodId,
          cardBrand: data.cardBrand,
          cardLast4: data.cardLast4
        }
        
        // Store the payment method ID for 30-day persistence
        if (data.paymentMethodId) {
          logger.log('💾 [Payment Check] Storing payment method ID:', data.paymentMethodId)
          storePaymentMethodId(data.paymentMethodId)
        } else {
          logger.log('⚠️ [Payment Check] No paymentMethodId in response!')
        }
        
        // Cache the successful result with device-specific key (7 days)
        localStorage.setItem(`payment_status_${uniqueDeviceId}_${deviceId}`, JSON.stringify(result))
        localStorage.setItem(`payment_status_timestamp_${uniqueDeviceId}_${deviceId}`, Date.now().toString())
        
        return result
      } else if (storedPaymentMethodId) {
        // If validation failed for the stored payment method ID, clear it
        logger.log('❌ [Payment Check] Stored payment method ID validation failed, clearing it')
        clearPaymentMethodId()
      } else {
        logger.log('❌ [Payment Check] No payment methods found')
      }
    } catch (error) {
      logger.log('Payment method check failed:', error)
      
      // If we have a cached result (even if expired), use it on network error
      const cachedPaymentStatus = localStorage.getItem(`payment_status_${uniqueDeviceId}_${deviceId}`)
      if (cachedPaymentStatus) {
        logger.log('Network error - using stale cache as fallback')
        return JSON.parse(cachedPaymentStatus)
      }
    }
    
    return { hasPaymentMethods: false }
  }

  const clearPaymentCache = () => {
    const uniqueDeviceId = getUniqueDeviceId()
    if (uniqueDeviceId && deviceId) {
      localStorage.removeItem(`payment_status_${uniqueDeviceId}_${deviceId}`)
      localStorage.removeItem(`payment_status_timestamp_${uniqueDeviceId}_${deviceId}`)
    }
  }

  // Store payment method ID with 30-day expiration
  const storePaymentMethodId = (paymentMethodId: string) => {
    const uniqueDeviceId = getUniqueDeviceId()
    logger.log('💾 [Store] Attempting to store payment method ID:', paymentMethodId)
    logger.log('💾 [Store] UniqueDeviceId:', uniqueDeviceId)
    
    if (uniqueDeviceId) {
      const key = `payment_method_id_${uniqueDeviceId}`
      const timestampKey = `payment_method_timestamp_${uniqueDeviceId}`
      localStorage.setItem(key, paymentMethodId)
      localStorage.setItem(timestampKey, Date.now().toString())
      logger.log('✅ [Store] Payment method ID stored with keys:', key, timestampKey)
      logger.log('💾 [Store] LocalStorage values:', {
        paymentMethodId: localStorage.getItem(key),
        timestamp: localStorage.getItem(timestampKey)
      })
    } else {
      logger.log('❌ [Store] Cannot store - missing userId or deviceId')
    }
  }

  // Retrieve and validate stored payment method ID (checks 30-day expiration)
  const getStoredPaymentMethodId = (): string | null => {
    const uniqueDeviceId = getUniqueDeviceId()
    logger.log('🔍 [Retrieve] Getting stored payment method - UniqueDeviceId:', uniqueDeviceId)
    
    // Try with current unique device ID first
    if (uniqueDeviceId) {
      const key = `payment_method_id_${uniqueDeviceId}`
      const timestampKey = `payment_method_timestamp_${uniqueDeviceId}`
      const paymentMethodId = localStorage.getItem(key)
      const timestamp = localStorage.getItem(timestampKey)

      logger.log('💾 [Retrieve] LocalStorage values with current uniqueDeviceId:', { paymentMethodId, timestamp })

      if (paymentMethodId && timestamp) {
        const storedTime = parseInt(timestamp)
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
        const now = Date.now()
        const age = now - storedTime
        const daysOld = age / (24 * 60 * 60 * 1000)

        logger.log('📅 [Retrieve] Payment method age:', daysOld.toFixed(2), 'days')

        if (age <= thirtyDaysMs) {
          logger.log('✅ [Retrieve] Valid payment method ID found with current uniqueDeviceId:', paymentMethodId)
          return paymentMethodId
        } else {
          localStorage.removeItem(key)
          localStorage.removeItem(timestampKey)
          logger.log('⏰ [Retrieve] Stored payment method ID expired (>30 days)')
        }
      }
    }
    
    // Fallback: search for any payment_method_id_* key
    logger.log('🔍 [Retrieve] Searching for any payment_method_id_* key in localStorage')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('payment_method_id_')) {
        const paymentMethodId = localStorage.getItem(key)
        const timestampKey = key.replace('payment_method_id_', 'payment_method_timestamp_')
        const timestamp = localStorage.getItem(timestampKey)
        
        if (paymentMethodId && timestamp) {
          const storedTime = parseInt(timestamp)
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
          const now = Date.now()
          const age = now - storedTime
          const daysOld = age / (24 * 60 * 60 * 1000)

          logger.log('📅 [Retrieve] Found payment method with age:', daysOld.toFixed(2), 'days')

          if (age <= thirtyDaysMs) {
            logger.log('✅ [Retrieve] Found valid payment method ID via fallback search:', paymentMethodId)
            return paymentMethodId
          }
        }
      }
    }

    logger.log('❌ [Retrieve] No valid payment method found')
    return null
  }

  // Retrieve stored Stripe customer ID with fallback search
  const getStoredCustomerId = (): string | null => {
    const uniqueDeviceId = getUniqueDeviceId()
    logger.log('🔍 [Retrieve Customer] Getting stored customer ID - UniqueDeviceId:', uniqueDeviceId)
    
    // Try with current unique device ID first
    if (uniqueDeviceId) {
      const key = `stripe_customer_id_${uniqueDeviceId}`
      const customerId = localStorage.getItem(key)
      
      logger.log('💾 [Retrieve Customer] LocalStorage value with current uniqueDeviceId:', customerId)
      
      if (customerId) {
        logger.log('✅ [Retrieve Customer] Found customer ID with current uniqueDeviceId:', customerId)
        return customerId
      }
    }
    
    // Fallback: search for any stripe_customer_id_* key
    logger.log('🔍 [Retrieve Customer] Searching for any stripe_customer_id_* key in localStorage')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('stripe_customer_id_')) {
        const customerId = localStorage.getItem(key)
        if (customerId) {
          logger.log('✅ [Retrieve Customer] Found customer ID via fallback search:', customerId)
          return customerId
        }
      }
    }

    logger.log('❌ [Retrieve Customer] No customer ID found')
    return null
  }

  // Refresh/extend the 30-day session for stored payment method
  const refreshPaymentMethodSession = () => {
    const tempUserId = localStorage.getItem('tipply_user_id')
    logger.log('🔄 [Refresh] Refreshing payment method session')
    
    if (tempUserId) {
      const key = `payment_method_id_${tempUserId}`
      const timestampKey = `payment_method_timestamp_${tempUserId}`
      const paymentMethodId = localStorage.getItem(key)
      
      if (paymentMethodId) {
        localStorage.setItem(timestampKey, Date.now().toString())
        logger.log('✅ [Refresh] Payment method session refreshed for another 30 days:', paymentMethodId)
      } else {
        logger.log('⚠️ [Refresh] No payment method ID to refresh')
      }
    } else {
      logger.log('❌ [Refresh] Missing userId')
    }
  }

  // Clear stored payment method ID
  const clearPaymentMethodId = () => {
    const uniqueDeviceId = getUniqueDeviceId()
    if (uniqueDeviceId) {
      localStorage.removeItem(`payment_method_id_${uniqueDeviceId}`)
      localStorage.removeItem(`payment_method_timestamp_${uniqueDeviceId}`)
    }
  }

  const getLightEffect = (amount: number): string => {
    if (amount >= 100) return 'rainbow'
    if (amount >= 50) return 'gold'
    if (amount >= 20) return 'purple'
    if (amount >= 10) return 'blue'
    if (amount >= 5) return 'green'
    return 'white'
  }

  const playTipSound = () => {
    if (audioRef.current) {
      try {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {})
        }
        audioRef.current.currentTime = 0
        audioRef.current.volume = 1
        audioRef.current.play().catch(() => {})
      } catch (error) {
        // Ignore audio errors
      }
    }
  }

  // Canvas confetti: a burst from the middle, then a lighter drop from the top so it keeps falling after the burst.
  // `ticks` is how many animation frames a piece lives (about 60 a second): 150-175 is 2.5-3 s; the library default is 200.
  const triggerCanvasConfetti = (amount: number) => {
    const tier =
      amount >= 50
        ? { burst: 220, spread: 90, velocity: 45, ticks: 160, drop: 180 } // same outburst and fall as $10-$49, just more of it
        : amount >= 10
          ? { burst: 100, spread: 90, velocity: 45, ticks: 160, drop: 90 }
          : { burst: 70, spread: 80, velocity: 40, ticks: 150, drop: 60 }
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']

    const runConfetti = async () => {
      try {
        if (!confettiLoader) {
          const module = await import('canvas-confetti')
          confettiLoader = module.default
        }

        confettiLoader({
          particleCount: tier.burst,
          spread: tier.spread,
          startVelocity: tier.velocity,
          origin: { y: 0.6 },
          colors,
          ticks: tier.ticks,
          gravity: 1,
          decay: 0.92,
          scalar: 1.2
        })

        // The drop: three light waves from above the screen, falling slowly across the whole width
        const waves = 3
        for (let i = 0; i < waves; i++) {
          setTimeout(() => {
            confettiLoader({
              particleCount: Math.round(tier.drop / waves),
              angle: 90,
              spread: 160,
              startVelocity: 18,
              origin: { x: 0.5, y: -0.1 },
              colors,
              ticks: tier.ticks - 40,
              gravity: 0.7,
              decay: 0.95,
              drift: 0,
              scalar: 1.1
            })
          }, 250 + i * 250)
        }
      } catch (error) {
        logger.log('Confetti module load failed:', error)
      }
    }

    void runConfetti()
  }

  const handleTipClick = (amount: number) => {
    // Tapping anything else quietly closes a question that is showing
    feedback.dismissNow()
    if (isDebouncing) return
    if (!deviceInfo || !userId) {
      logger.log('⏳ [handleTipClick] Not ready yet - deviceInfo:', !!deviceInfo, 'userId:', !!userId)
      toast.error('Still loading, please try again in a moment')
      return
    }

    logger.log('🎯 [handleTipClick] Called with amount:', amount, 'selectedSong:', selectedSong)

    // Haptic tap straight from the click (iPhone only allows it inside the tap), stronger for bigger tips
    tipHaptic(amount)

    // Trigger canvas confetti immediately
    triggerCanvasConfetti(amount)

    // Enable audio on first interaction
    if (!audioEnabled) {
      void enableAudio()
    }
    playTipSound()

    // Short debounce to prevent accidental double taps
    setIsDebouncing(true)
    setTimeout(() => setIsDebouncing(false), 150)

    // Immediate feedback: the tapped button shows "Sent" for a moment
    setSentAmount(amount)
    if (sentTimer.current) clearTimeout(sentTimer.current)
    sentTimer.current = setTimeout(() => setSentAmount(null), 1600)

    // If song is selected, this completes the song request
    if (selectedSong) {
      const trimmedName = songRequestName.trim()
      const trimmedNote = songRequestNote.trim()
      const selectedSongSnapshot = {
        ...selectedSong,
        ...(trimmedName ? { requestorName: trimmedName } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {})
      }
      setSelectedSong(null)
      setShowSongSearch(false)
      setSongRequestName('')
      setSongRequestNote('')
      setSentSong({ title: selectedSongSnapshot.title, artist: selectedSongSnapshot.artist })
      if (sentSongTimer.current) clearTimeout(sentSongTimer.current)
      sentSongTimer.current = setTimeout(() => setSentSong(null), 4000)
      logger.log('🎵 [handleTipClick] Song is selected, calling processTipWithSong:', selectedSongSnapshot.id)
      void processTipWithSong(amount, selectedSongSnapshot)
      return
    }

    // Regular tip
    logger.log('💰 [handleTipClick] No song selected, calling processTip')
    void processTip(amount)
  }

  const processTip = async (amount: number) => {
    // Submit tip
    try {
      // Get stored payment method ID and customer ID using fallback search
      const paymentMethodId = getStoredPaymentMethodId()
      const stripeCustomerId = getStoredCustomerId()
      
      logger.log('💳 Retrieved payment method ID:', paymentMethodId)
      logger.log('💳 Retrieved Stripe customer ID:', stripeCustomerId)
      
      const tipPayload = {
        deviceId: deviceInfo!.uuid,
        userId: userId,
        amount: amount,
        effect: getLightEffect(amount),
        duration: 3000,
        paymentMethodId: paymentMethodId || undefined,
        stripeCustomerId: stripeCustomerId || undefined,
        ...(deviceInfo?.isVenueDevice && deviceInfo.sessionId ? { expectedSessionId: deviceInfo.sessionId } : {})
      }
      logger.log('🎰 SUBMITTING TIP PAYLOAD TO BACKEND (Classic Mode):', tipPayload)

      const response = await apiService.submitTip(tipPayload)

      if (response.data) {
        await loadUserTotal(userId)
        // Refresh payment method session on successful tip (extends 30-day memory)
        refreshPaymentMethodSession()
        void feedback.onTipConfirmed(songPickerUsed.current)
      } else {
        // Provide specific error messages based on error type
        // On a venue device the performer may have changed since this page loaded; nothing was charged
        if (response.raw?.code === 'performer_changed' || response.raw?.code === 'no_performer') {
          setSentAmount(null); setSentSong(null)
          toast.error(response.error || 'The performer just changed. Please refresh.')
          setTimeout(() => window.location.reload(), 1800)
          return
        }
        let errorMsg = response.error || 'Failed to submit tip. Please try again.'
        if (response.errorType === 'timeout') {
          errorMsg = '⏱️ Request timeout - the server took too long to respond. Please check your internet connection and try again.'
        } else if (response.errorType === 'network') {
          errorMsg = '🌐 Network error - unable to connect to the server. Please check your internet connection.'
        } else if (response.errorType === 'validation') {
          errorMsg = response.error || 'Invalid tip details. Please check and try again.'
        } else if (response.errorType === 'authentication') {
          errorMsg = 'Session expired. Please refresh and try again.'
        } else if (response.errorType === 'server') {
          errorMsg = '⚠️ Server error. Please try again in a moment.'
        }
        logger.error('❌ Tip submission failed:', response.raw, 'Error:', errorMsg, 'Type:', response.errorType)
        setSentAmount(null)
        toast.error(errorMsg)
      }
    } catch (error) {
      logger.error('❌ Error submitting tip:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to submit tip. Please try again.'
      setSentAmount(null)
        toast.error(errorMsg)
    }

  }

  const processTipWithSong = async (
    amount: number,
    selectedSongSnapshot: { id: string; title: string; artist: string; requestorName?: string; note?: string }
  ) => {
    logger.log('🎵 [processTipWithSong] Starting, selectedSong:', selectedSongSnapshot)
    try {
      // Get stored payment method ID and customer ID using fallback search
      const paymentMethodId = getStoredPaymentMethodId()
      const stripeCustomerId = getStoredCustomerId()
      
      logger.log('💳 Retrieved payment method ID:', paymentMethodId)
      logger.log('💳 Retrieved Stripe customer ID:', stripeCustomerId)
      
      logger.log('🎵 [processTipWithSong] Before payload construction - selectedSong:', selectedSongSnapshot)
      const tipPayload = {
        deviceId: deviceInfo!.uuid,
        userId: userId,
        amount: amount,
        effect: getLightEffect(amount),
        duration: 3000,
        paymentMethodId: paymentMethodId || undefined,
        stripeCustomerId: stripeCustomerId || undefined,
        ...(deviceInfo?.isVenueDevice && deviceInfo.sessionId ? { expectedSessionId: deviceInfo.sessionId } : {}),
        // Include song request fields if song is selected
        ...(selectedSongSnapshot && {
          songId: selectedSongSnapshot.id,
          ...(selectedSongSnapshot.requestorName ? { requestorName: selectedSongSnapshot.requestorName } : {}),
          ...(selectedSongSnapshot.note ? { note: selectedSongSnapshot.note } : {})
        })
      }
      logger.log('🎰 SUBMITTING TIP PAYLOAD TO BACKEND (Cards Mode):', tipPayload)
      logger.log('🎵 [processTipWithSong] songId in payload:', tipPayload.songId, 'selectedSong.id was:', selectedSongSnapshot?.id)

      // Submit tip
      const response = await apiService.submitTip(tipPayload)

      if (response.data) {
        await loadUserTotal(userId)
        if (selectedSong?.id === selectedSongSnapshot.id) {
          setSelectedSong(null)
          setShowSongSearch(false)
          setSongRequestName('')
          setSongRequestNote('')
        }
        // Refresh payment method session on successful tip (extends 30-day memory)
        refreshPaymentMethodSession()
        void feedback.onTipConfirmed(true)
      } else {
        // Provide specific error messages based on error type
        // On a venue device the performer may have changed since this page loaded; nothing was charged
        if (response.raw?.code === 'performer_changed' || response.raw?.code === 'no_performer') {
          setSentAmount(null); setSentSong(null)
          toast.error(response.error || 'The performer just changed. Please refresh.')
          setTimeout(() => window.location.reload(), 1800)
          return
        }
        let errorMsg = response.error || 'Failed to submit tip. Please try again.'
        if (response.errorType === 'timeout') {
          errorMsg = '⏱️ Request timeout - the server took too long to respond. Please check your internet connection and try again.'
        } else if (response.errorType === 'network') {
          errorMsg = '🌐 Network error - unable to connect to the server. Please check your internet connection.'
        } else if (response.errorType === 'validation') {
          errorMsg = response.error || 'Invalid tip details. Please check and try again.'
        } else if (response.errorType === 'authentication') {
          errorMsg = 'Session expired. Please refresh and try again.'
        } else if (response.errorType === 'server') {
          errorMsg = '⚠️ Server error. Please try again in a moment.'
        }
        logger.error('❌ Tip submission failed:', response.raw, 'Error:', errorMsg, 'Type:', response.errorType)
        setSentAmount(null); setSentSong(null)
        toast.error(errorMsg)
      }
    } catch (error) {
      logger.error('❌ Error submitting tip with song:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to submit tip. Please try again.'
      setSentAmount(null); setSentSong(null)
        toast.error(errorMsg)
    }

  }

  const handleSongPick = (song: PickedSong) => {
    songPickerUsed.current = true
    setSelectedSong({ id: song.id, title: song.title, artist: song.artist })
    setSongRequestName(song.requestorName ?? '')
    setSongRequestNote(song.note ?? '')
    setShowSongSearch(false)
  }

  const clearSelectedSong = () => {
    setSelectedSong(null)
    setSongRequestName('')
    setSongRequestNote('')
  }

  const performerName =
    deviceInfo?.stageName || `${deviceInfo?.ownerFirstName ?? ''} ${deviceInfo?.ownerLastName ?? ''}`.trim()
  const ready = !!deviceInfo && !!userId
  // Always offer the button when the performer allows song requests; the picker explains an empty catalog
  const canRequestSong = !!deviceInfo?.isAllowSongRequest

  const paymentModal = (
    <Suspense fallback={null}>
      <PaymentSetupModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onComplete={(paymentMethodId) => {
          logger.log('🎉 Payment setup complete! Payment method ID:', paymentMethodId)
          if (paymentMethodId) {
            storePaymentMethodId(paymentMethodId)
          }
          clearPaymentCache() // Clear cache so next check will be fresh
          setIsPaymentSetup(true)
          setShowPaymentModal(false)
          // Show the new card on the page
          void checkPaymentMethods(deviceInfo).then((result) => {
            if (result.hasPaymentMethods) setSavedCard({ brand: result.cardBrand, last4: result.cardLast4 })
          })
          toast.success('Payment method saved', { duration: 1200 })
        }}
        deviceUuid={deviceInfo?.uuid || ''}
        userId={userId}
        performerStageName={deviceInfo?.stageName}
        performerFirstName={deviceInfo?.ownerFirstName}
        performerLastName={deviceInfo?.ownerLastName}
        performerPhotoUrl={deviceInfo?.profilePhotoUrl}
        walletMode="both"
      />
    </Suspense>
  )

  // While the performer loads, show the real layout with placeholders so nothing jumps
  if (checkingPaymentMethods) {
    return (
      <TipScreen
        performerName=""
        amounts={DEFAULT_TIP_AMOUNTS}
        ready={false}
        sentAmount={null}
        onTip={() => {}}
        canRequestSong={false}
        selectedSong={null}
        onOpenSongPicker={() => {}}
        onClearSong={() => {}}
        card={null}
        onChangeCard={() => {}}
        total={0}
      />
    )
  }

  // A venue's device with nobody on it, or a performer's poster while someone else is on: no tipping
  if (deviceInfo?.noActivePerformer) {
    return (
      <InfoScreen feedback={userId ? { userId, deviceUuid: deviceInfo?.uuid } : undefined} icon="clock" title="No one is performing right now">
        {deviceInfo.venueName ? `${deviceInfo.venueName} has this device, but` : 'Nobody is using this device and'} tips are paused until a performer starts. This page checks again by itself.
      </InfoScreen>
    )
  }
  if (deviceInfo?.performerMismatch) {
    return (
      <InfoScreen
        feedback={userId ? { userId, deviceUuid: deviceInfo?.uuid } : undefined}
        icon="info"
        title={`${deviceInfo.expectedPerformerName || 'This performer'} is not active here right now`}
      >
        {deviceInfo.expectedPerformerName || 'This performer'} is not using this Tipwave device at the moment, so tips cannot go to them here. To tip the performer who is on, scan the venue's own QR code on the device.
      </InfoScreen>
    )
  }

  // Check if device is verified (Stripe and KYC)
  if (isDeviceVerified === false) {
    return (
      <InfoScreen feedback={userId ? { userId, deviceUuid: deviceInfo?.uuid } : undefined} icon="shield" title="Performer not set up">
        This performer is not set up to receive tips yet. Please let them know.
      </InfoScreen>
    )
  }

  // Block desktop usage and prompt user to open on mobile
  if (!isMobile) {
    return (
      <InfoScreen feedback={userId ? { userId, deviceUuid: deviceInfo?.uuid } : undefined} icon="qr" title="Open this on your phone">
        The tipping page is made for phones. Scan the QR code again with your phone's camera.
      </InfoScreen>
    )
  }

  if (!isPaymentSetup) {
    return (
      <>
        <InfoScreen
          feedback={userId ? { userId, deviceUuid: deviceInfo?.uuid } : undefined}
          icon="card"
          title="Add a card to tip"
          action={
            <Button size="lg" block onClick={() => setShowPaymentModal(true)}>
              Add a card
            </Button>
          }
        >
          Add a payment method to continue tipping.
        </InfoScreen>
        {paymentModal}
        <TipperRefundNotice userId={userId} />
      </>
    )
  }

  return (
    <>
      <TipScreen
        performerName={performerName}
        venueName={deviceInfo?.isVenueDevice ? deviceInfo.venueName : undefined}
        photoUrl={deviceInfo?.profilePhotoUrl}
        bio={deviceInfo?.bio}
        amounts={tipAmounts}
        ready={ready}
        sentAmount={sentAmount}
        onTip={handleTipClick}
        canRequestSong={canRequestSong}
        selectedSong={selectedSong}
        sentSong={sentSong}
        onOpenSongPicker={() => {
          feedback.dismissNow()
          songPickerUsed.current = true
          setShowSongSearch(true)
        }}
        onClearSong={clearSelectedSong}
        card={savedCard}
        onChangeCard={() => {
          feedback.dismissNow()
          setShowPaymentModal(true)
        }}
        total={totalTipped}
        bottomBarOverride={
          feedback.prompt && (feedback.phase === 'thanks' || (feedback.phase === 'asking' && sentAmount === null && !showSongSearch && !showPaymentModal)) ? (
            <FeedbackBar prompt={feedback.prompt} phase={feedback.phase} onRate={feedback.rate} onChoose={feedback.choose} onDismiss={feedback.dismissNow} />
          ) : undefined
        }
        footerLink={<GiveFeedbackLink userId={userId} deviceUuid={deviceInfo?.uuid} />}
      />

      {feedback.prompt && (
        <FeedbackFormModal
          open={feedback.phase === 'followup'}
          title={feedback.prompt.question === 'ease' ? 'Sorry about that. What was it about?' : 'Which song were you looking for?'}
          reasons={feedback.prompt.question === 'ease' ? feedback.prompt.reasons : []}
          alreadyLow
          placeholder={feedback.prompt.textPlaceholder}
          sendLabel="Send"
          skipLabel="Skip"
          onSend={async body => {
            feedback.sendFollowUp({ choice: body.choice, comment: body.comment })
          }}
          onClose={() => feedback.sendFollowUp({})}
        />
      )}

      {!isPortrait && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/85 px-6 text-center text-white">
          <BrandIcon name="refresh" size={36} tone="inverse" />
          <p className="mt-4 text-lg font-semibold">Portrait mode only</p>
          <p className="mt-1 text-sm text-white/80">Please turn your phone upright to keep tipping.</p>
        </div>
      )}

      <SongPickerSheet
        open={showSongSearch}
        deviceUuid={deviceInfo?.uuid || ''}
        current={selectedSong ? { ...selectedSong, requestorName: songRequestName, note: songRequestNote } : null}
        onClose={() => setShowSongSearch(false)}
        onPick={handleSongPick}
      />

      {paymentModal}

      <TipperRefundNotice userId={userId} />

      {/* Audio Element */}
      <audio ref={audioRef} src="/cash-register.mp3" preload="auto" />
    </>
  )
}

export default TippingInterface
