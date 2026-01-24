import logger from "../utils/logger";
import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import PaymentSetupModal from '../components/PaymentSetupModal'
import SongCatalogSearch from '../components/SongCatalogSearch'
import apiService from '../services/api'
import { getApiBaseUrl } from '../utils/config'
import { getUniqueDeviceId, detectPlatform } from '../utils/deviceId'

interface DeviceInfo {
  id: string
  uuid: string
  ownerFirstName: string
  ownerLastName: string
    stageName?: string
  profilePhotoUrl?: string
  ownerId: string
  stripeAccountId?: string
  isAllowSongRequest?: boolean
}

interface PaymentMethodsCheckResult {
  hasPaymentMethods: boolean
  paymentMethodType?: string
}

const TippingInterface: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>()
  const [totalTipped, setTotalTipped] = useState<number>(0)
  const [tipsRefreshKey, setTipsRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isPaymentSetup, setIsPaymentSetup] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [checkingPaymentMethods, setCheckingPaymentMethods] = useState(true)
  const [isDeviceVerified, setIsDeviceVerified] = useState<boolean | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [clickedAmount, setClickedAmount] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isIOS] = useState(() => {
    // Detect iOS on initialization to prevent layout shift
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  })
  const [isPortrait, setIsPortrait] = useState(true)
  
  // Song request state
  const [showSongSearch, setShowSongSearch] = useState(false)
  const [selectedSong, setSelectedSong] = useState<{id: string, title: string, artist: string, requestorName?: string, note?: string} | null>(null)
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

    const [billRefresh, setBillRefresh] = useState(0)
  const [gridSelectedAmount, setGridSelectedAmount] = useState<number | null>(null)
  const [imagesReady, setImagesReady] = useState(false)
  // Tip amounts for the cards
  const tipAmounts = [1, 5, 10, 20, 50, 100]

  // Card colors - vibrant gradients
  const cardColors = [
    'from-emerald-400 to-teal-600',     // $1 - Green
    'from-blue-400 to-indigo-600',      // $5 - Blue
    'from-purple-400 to-violet-600',    // $10 - Purple
    'from-pink-400 to-rose-600',        // $20 - Pink
    'from-orange-400 to-red-600',       // $50 - Orange/Red
    'from-yellow-400 to-amber-600'      // $100 - Gold
  ]

  // Classic swipe UI state
  // Force grid/cards UI as the primary experience
  const [uiMode] = useState<'classic' | 'cards'>('cards')
  const [classicIndex, setClassicIndex] = useState(0)
  const [isBillFlying, setIsBillFlying] = useState(false)
  const [enterSide, setEnterSide] = useState<'bottom' | 'left' | 'right'>('bottom')
  const ANIM = {
    exitFly: 0.8,
    enterSlide: 0.7,
    fadeExit: 0.25,
    ease: 'easeInOut' as const
  }
  // Track fly state to sync exit animation; entry always starts from bottom
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  // Manage body overflow
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  // Update mobile status bar / theme color to match UI mode
  useEffect(() => {
    const themeColor = uiMode === 'cards' ? '#1e1b4b' : '#000000'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', themeColor)
    }
    
    // Also update Apple status bar style
    const appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (appleStatusBar) {
      appleStatusBar.setAttribute('content', 'black-translucent')
    }
  }, [uiMode])

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

  // Lock UI to portrait by showing overlay when rotated
  useEffect(() => {
    const updateOrientation = () => {
      const portrait = window.matchMedia('(orientation: portrait)').matches || window.innerHeight >= window.innerWidth
      setIsPortrait(portrait)
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
    }
  }, [])

  // Try to lock orientation to portrait where supported (Android Chrome/PWA)
  useEffect(() => {
    const attemptLock = async () => {
      const ori: any = (window.screen as any).orientation
      if (ori && typeof ori.lock === 'function') {
        try {
          await ori.lock('portrait-primary')
        } catch (e) {
          // Ignore if not supported or requires fullscreen/user gesture
        }
      }
    }

    // Try immediately and again on first interaction (helps Chrome on Android)
    attemptLock()
    const onFirstInteraction = () => attemptLock()
    window.addEventListener('touchstart', onFirstInteraction, { once: true })
    window.addEventListener('click', onFirstInteraction, { once: true })
    return () => {
      window.removeEventListener('touchstart', onFirstInteraction)
      window.removeEventListener('click', onFirstInteraction)
    }
  }, [])

  // Initialize user
  useEffect(() => {
    const initializeUser = async () => {
      // Get unique device ID (deterministic and reproducible)
      const uniqueDeviceId = getUniqueDeviceId()
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
      
        const url = `${getApiBaseUrl()}/api/tips/user-total/${tempUserId}`
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

  // Fetch device info and check payment methods
  useEffect(() => {
    const fetchDeviceData = async () => {
      if (!deviceId) return
      
      try {
        const deviceResponse = await fetch(`${getApiBaseUrl()}/api/devices/${deviceId}/public`)
        if (!deviceResponse.ok) {
          toast.error('Device not found')
          return
        }
        
        const device = await deviceResponse.json()
        const deviceInfoData = {
          id: device.id,
          uuid: device.uuid,
          ownerFirstName: device.ownerFirstName,
          ownerLastName: device.ownerLastName,
            stageName: device.stageName,
          profilePhotoUrl: device.profilePhotoUrl,
          ownerId: device.id, // Using device.id since profileId is not exposed in public endpoint
          stripeAccountId: '', // Not exposed in public endpoint
          isAllowSongRequest: device.isAllowSongRequest,
          isStripeVerified: device.isStripeVerified || false,
          isKycVerified: device.isKycVerified || false
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

        // Check AWS IoT status
        try {
          const response = await apiService.getAwsIotStatus()
          logger.log('AWS IoT Status:', response)
        } catch (error) {
          logger.log('AWS IoT Status check failed:', error)
        }

        // Check payment methods using the device UUID
        const paymentCheck = await checkPaymentMethods(deviceInfoData)
        setIsPaymentSetup(paymentCheck.hasPaymentMethods)
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
          paymentMethodId: data.paymentMethodId
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

  const getCurrencyImage = (amount: number): string => {
    const images: Record<number, string> = {
      1: '/images/1dollar.png',
      5: '/images/5dollars.png',
      10: '/images/10dollars.png',
      20: '/images/20dollars.png',
      50: '/images/50dollars.png',
      100: '/images/100dollars.png'
    }
    return images[amount] || '/images/1dollar.png'
  }

  // Preload all bill images so they are ready before tipping UI/toasts
  useEffect(() => {
    let isMounted = true
    const preload = async () => {
      const urls = tipAmounts.map(getCurrencyImage)
      await Promise.all(
        urls.map(
          (url) =>
            new Promise<void>((resolve) => {
              const img = new Image()
              img.onload = () => resolve()
              img.onerror = () => resolve()
              img.src = url
            })
        )
      )
      if (isMounted) setImagesReady(true)
    }
    preload()
    return () => {
      isMounted = false
    }
  }, [])

  const cycleClassicIndex = (direction: -1 | 1) => {
    if (isBillFlying) return
    setEnterSide(direction === -1 ? 'left' : 'right')
    setClassicIndex(prev => {
      const next = prev + direction
      if (next < 0) return tipAmounts.length - 1
      if (next >= tipAmounts.length) return 0
      return next
    })
  }

  const handleClassicTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isBillFlying) return
    const touch = e.touches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleClassicTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeStart.current || isBillFlying) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - swipeStart.current.x
    const dy = touch.clientY - swipeStart.current.y
    // Reduced thresholds for more responsive swipes
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      setEnterSide(dx > 0 ? 'left' : 'right')
      cycleClassicIndex(dx > 0 ? -1 : 1)
    } else if (Math.abs(dy) > Math.abs(dx) && dy < -25) {
      handleClassicTip()
    }
    swipeStart.current = null
  }

  const handleClassicTip = () => {
    if (isBillFlying || loading) return
    const amount = tipAmounts[classicIndex]
    const exitDuration = 800

    // Trigger haptic feedback immediately
    triggerHaptic()

    // Trigger exit animation (don't change key yet - old bill stays and exits)
    setIsBillFlying(true)

    // Submit tip WITHOUT confetti
    processTip(amount, true).catch(() => {})

    // After exit completes: fire confetti, THEN mount new bill with updated key
    setTimeout(() => {
      triggerCanvasConfetti(amount)
      setEnterSide('bottom')
      setBillRefresh((v) => v + 1)
      setIsBillFlying(false)
    }, exitDuration)
  }

  // Trigger haptic feedback (Web Vibration API)
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50) // 50ms subtle vibration
    }
  }

  // Canvas confetti with gradual intensity per denomination
  const triggerCanvasConfetti = (amount: number) => {
    // Confetti configuration based on denomination
    const getConfettiConfig = (amt: number) => {
      if (amt >= 100) {
        return { particleCount: 150, spread: 100, startVelocity: 50, duration: 500 }
      } else if (amt >= 50) {
        return { particleCount: 100, spread: 90, startVelocity: 45, duration: 450 }
      } else if (amt >= 20) {
        return { particleCount: 70, spread: 80, startVelocity: 40, duration: 400 }
      } else if (amt >= 10) {
        return { particleCount: 60, spread: 75, startVelocity: 38, duration: 375 }
      } else if (amt >= 5) {
        return { particleCount: 60, spread: 75, startVelocity: 38, duration: 375 }
      } else {
        return { particleCount: 60, spread: 75, startVelocity: 38, duration: 375 }
      }
    }

    const config = getConfettiConfig(amount)

    confetti({
      particleCount: config.particleCount,
      spread: config.spread,
      startVelocity: config.startVelocity,
      origin: { y: 0.6 },
      colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
      ticks: config.duration / 16.67, // Convert ms to ticks (60fps)
      gravity: 1.2,
      scalar: 1.2
    })
  }

  const handleTipClick = async (amount: number) => {
    if (loading || !deviceInfo || !userId) return

    logger.log('🎯 [handleTipClick] Called with amount:', amount, 'selectedSong:', selectedSong)

    // Trigger haptic feedback immediately
    triggerHaptic()

    // Trigger canvas confetti immediately (grid mode)
    if (uiMode === 'cards') {
      triggerCanvasConfetti(amount)
    }

    // Enable audio on first interaction
    if (!audioEnabled) {
      await enableAudio()
    }

    // If song is selected, this completes the song request
    if (selectedSong) {
      logger.log('🎵 [handleTipClick] Song is selected, calling processTipWithSong:', selectedSong.id)
      await processTipWithSong(amount)
      return
    }

    // Regular tip
    logger.log('💰 [handleTipClick] No song selected, calling processTip')
    await processTip(amount)
  }

  const processTip = async (amount: number, skipConfetti = false) => {
    setLoading(true)
    setClickedAmount(amount)
    
    // Show confetti immediately (unless skipped for classic mode)
    if (!skipConfetti) {
      triggerCanvasConfetti(amount)
    }

    // Play sound
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
        // Include song request fields if song is selected
        ...(selectedSong && {
          songId: selectedSong.id,
          requestorName: selectedSong.requestorName,
          note: selectedSong.note
        })
      }
      logger.log('🎰 SUBMITTING TIP PAYLOAD TO BACKEND (Classic Mode):', tipPayload)

      const response = await apiService.submitTip(tipPayload)

      if (response.data) {
        if (selectedSong) {
          toast.success(`$${amount} tip with song request sent!`, { duration: 800 })
          setSelectedSong(null)
          setShowSongSearch(false)
          setTipsRefreshKey(prev => prev + 1)
          await loadUserTotal(userId)
        } else {
          toast.success(`$${amount} tip sent!`, { duration: 800 })
          await loadUserTotal(userId)
        }
        // Refresh payment method session on successful tip (extends 30-day memory)
        refreshPaymentMethodSession()
      } else {
        const errorMsg = response.raw?.error || response.error || 'Failed to submit tip. Please try again.'
        logger.error('❌ Tip submission failed:', response.raw)
        toast.error(errorMsg)
      }
    } catch (error) {
      logger.error('❌ Error submitting tip:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit tip. Please try again.')
    }

    setLoading(false)
    setClickedAmount(null)
  }

  const processTipWithSong = async (amount: number) => {
    logger.log('🎵 [processTipWithSong] Starting, selectedSong:', selectedSong)
    setLoading(true)
    setClickedAmount(amount)
    triggerCanvasConfetti(amount)

    // Play sound
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      } catch (error) {
        // Ignore audio errors
      }
    }

    try {
      // Get stored payment method ID and customer ID using fallback search
      const paymentMethodId = getStoredPaymentMethodId()
      const stripeCustomerId = getStoredCustomerId()
      
      logger.log('💳 Retrieved payment method ID:', paymentMethodId)
      logger.log('💳 Retrieved Stripe customer ID:', stripeCustomerId)
      
      logger.log('🎵 [processTipWithSong] Before payload construction - selectedSong:', selectedSong)
      const tipPayload = {
        deviceId: deviceInfo!.uuid,
        userId: userId,
        amount: amount,
        effect: getLightEffect(amount),
        duration: 3000,
        paymentMethodId: paymentMethodId || undefined,
        stripeCustomerId: stripeCustomerId || undefined,
        // Include song request fields if song is selected
        ...(selectedSong && {
          songId: selectedSong.id,
          requestorName: selectedSong.requestorName,
          note: selectedSong.note
        })
      }
      logger.log('🎰 SUBMITTING TIP PAYLOAD TO BACKEND (Cards Mode):', tipPayload)
      logger.log('🎵 [processTipWithSong] songId in payload:', tipPayload.songId, 'selectedSong.id was:', selectedSong?.id)

      // Submit tip
      const response = await apiService.submitTip(tipPayload)

      if (response.data) {
        if (selectedSong) {
          toast.success(`$${amount} tip with song request submitted!`)
        } else {
          toast.success(`$${amount} tip submitted!`)
        }
        await loadUserTotal(userId)
        setSelectedSong(null)
        setShowSongSearch(false)
        setTipsRefreshKey(prev => prev + 1)
        // Refresh payment method session on successful tip (extends 30-day memory)
        refreshPaymentMethodSession()
      } else {
        const errorMsg = response.raw?.error || response.error || 'Failed to submit tip. Please try again.'
        logger.error('❌ Tip submission failed:', response.raw)
        toast.error(errorMsg)
      }
    } catch (error) {
      logger.error('❌ Error submitting tip with song:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit tip. Please try again.')
    }

    setLoading(false)
    setClickedAmount(null)
  }

  const handleSongSelect = (song: {id: string, title: string, artist: string, requestorName?: string, note?: string}) => {
    setSelectedSong(song)
    setShowSongSearch(false)
    toast.success(`Song selected: ${song.title} by ${song.artist}. Now select a tip amount!`)
  }

  if (checkingPaymentMethods) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Check if device is verified (Stripe and KYC)
  if (isDeviceVerified === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Performer Not Set Up</h2>
          <p className="text-white/80 mb-6">
            This Performer is currently not set up to fully use the TipWave platform. Please contact your performer.
          </p>
        </div>
      </div>
    )
  }

  // Block desktop usage and prompt user to open on mobile
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center max-w-md mx-auto border border-white/20">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-2xl font-bold text-white mb-4">Mobile Only</h1>
          <p className="text-white/80 text-lg leading-relaxed">
            This tipping interface is designed for mobile devices only. Please open this page on your smartphone or tablet for the best experience.
          </p>
        </div>
      </div>
    )
  }

  if (!isPaymentSetup) {
    return (
      <PaymentSetupModal
        isOpen={true}
        onClose={() => setShowPaymentModal(false)}
        onComplete={(paymentMethodId) => {
          logger.log('🎉 Payment setup complete! Payment method ID:', paymentMethodId)
          if (paymentMethodId) {
            storePaymentMethodId(paymentMethodId)
          }
          setIsPaymentSetup(true)
          setShowPaymentModal(false)
          toast.success('Payment method added successfully!')
        }}
        deviceUuid={deviceInfo?.uuid || ''}
        userId={userId}
        performerStageName={deviceInfo?.stageName}
        performerFirstName={deviceInfo?.ownerFirstName}
        performerLastName={deviceInfo?.ownerLastName}
        performerPhotoUrl={deviceInfo?.profilePhotoUrl}
      />
    )
  }

  // Show desktop warning if not on mobile
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center max-w-md mx-auto border border-white/20">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-2xl font-bold text-white mb-4">Mobile Only</h1>
          <p className="text-white/80 text-lg leading-relaxed">
            This tipping interface is designed for mobile devices only. Please open this page on your smartphone or tablet for the best experience.
          </p>
        </div>
      </div>
    )
  }

  // Ensure bill images are ready before showing the tipping UI / toasts
  if (!imagesReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading images...</div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen relative ${uiMode === 'classic' ? 'overflow-hidden' : ''} ${uiMode === 'cards' ? 'bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900' : 'bg-black'}`}>
      {!isPortrait && (
        <div className="fixed inset-0 z-50 bg-black/80 text-white flex flex-col items-center justify-center px-6 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-semibold mb-2">Portrait mode only</p>
          <p className="text-sm text-white/80">Please rotate your device back to portrait to continue tipping.</p>
        </div>
      )}

      {/* Background Effects - cards mode only */}
      {uiMode === 'cards' && (
        <>
          <div className="absolute inset-0 bg-black/20"></div>
      
      {/* Animated Background Particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/10 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
          </div>
        </>
      )}

      {/* Classic Swipe UI - Full Screen Bill */}
      {uiMode === 'classic' && false && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          onTouchStart={handleClassicTouchStart}
          onTouchEnd={handleClassicTouchEnd}
        >
          {/* Full screen currency image */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`bill-${classicIndex}-${billRefresh}`}
              className="absolute inset-0 flex-1"
              initial={
                isBillFlying 
                  ? { y: 0, opacity: 1, scale: 1 }
                  : enterSide === 'left'
                    ? { x: -window.innerWidth, opacity: 0, scale: 1 }
                    : enterSide === 'right'
                      ? { x: window.innerWidth, opacity: 0, scale: 1 }
                      : { y: window.innerHeight, opacity: 0, scale: 0.8 }
              }
              animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              exit={
                isBillFlying
                  ? { y: -window.innerHeight - 100, opacity: 0, rotate: 360, scale: 1.2 }
                  : { opacity: 0 }
              }
              transition={{ 
                duration: isBillFlying ? ANIM.exitFly : ANIM.enterSlide, 
                ease: ANIM.ease 
              }}
            >
              <img
                src={getCurrencyImage(tipAmounts[classicIndex])}
                alt={`$${tipAmounts[classicIndex]} bill`}
                className="w-full h-full object-cover"
              />
            </motion.div>
          </AnimatePresence>

          {/* Up arrow hint */}
          <AnimatePresence>
            {!isBillFlying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, -10, 0] }}
                exit={{ opacity: 0 }}
                transition={{ y: { duration: 2, repeat: Infinity }, opacity: { duration: 0.3 } }}
                className="absolute top-8 left-1/2 -translate-x-1/2 text-white text-6xl drop-shadow-2xl z-40"
              >
                ↑
              </motion.div>
            )}
          </AnimatePresence>

          {/* Owner name overlay */}
          <AnimatePresence>
            {!isBillFlying && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-24 left-1/2 -translate-x-1/2 z-40 text-center"
              >
                <div className="bg-black/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
                  <div className="flex items-center gap-3">
                    {deviceInfo?.profilePhotoUrl && (
                      <img
                        src={deviceInfo?.profilePhotoUrl}
                        alt="Performer"
                        className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
                      />
                    )}
                    <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                        Tip {deviceInfo?.stageName || `${deviceInfo?.ownerFirstName} ${deviceInfo?.ownerLastName}`}
                    </h1>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

            {/* Song Request - Classic mode (overlay) */}
            <AnimatePresence>
              {!isBillFlying && deviceInfo?.isAllowSongRequest && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-[min(40vh,20rem)] left-0 right-0 z-40 flex justify-center px-4"
                >
                  {selectedSong ? (
                    <div className="bg-green-500/30 backdrop-blur-md rounded-2xl px-4 py-3 border border-green-400/30 shadow-2xl max-w-sm w-full">
                      <div className="text-white text-xs font-semibold mb-1">🎵 Song Selected</div>
                      <div className="text-white/90 text-sm">{selectedSong?.title}</div>
                      <div className="text-white/70 text-xs">{selectedSong?.artist}</div>
                      <div className="text-white/60 text-sm mt-2 mb-1">Select a tip amount above to send your song request</div>
                      <button
                        onClick={() => setSelectedSong(null)}
                        className="text-white/70 hover:text-white text-xs mt-1 underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSongSearch(true)}
                      className="bg-black/40 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-white/20 hover:bg-black/60 transition-colors flex items-center gap-2 text-sm font-semibold shadow-2xl"
                    >
                      <span>🎵</span>
                      <span>Request Song</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls at bottom */}
          <AnimatePresence>
            {!isBillFlying && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 left-0 right-0 z-40 flex items-end justify-center pb-[max(env(safe-area-inset-bottom),1.5rem)] px-4"
              >
                <div className="relative bg-black/60 backdrop-blur-md rounded-3xl p-6 w-full max-w-sm border border-white/20 shadow-2xl">
                  <div className="text-white/90 text-xs mb-4 font-medium text-center">Swipe left/right to change • Swipe up to send</div>
                  <div className="flex items-center justify-center gap-4 mb-3">
                    <button
                      onClick={() => cycleClassicIndex(-1)}
                      className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm text-white text-2xl flex items-center justify-center hover:bg-white/30 transition-colors border border-white/20 flex-shrink-0"
                    >
                      ←
                    </button>
                    <div className="text-center flex-grow">
                      <span className="text-white/80 text-xs uppercase tracking-wider mr-2">Amount:</span>
                      <span className="text-white/80 text-xs uppercase tracking-wider font-black">${tipAmounts[classicIndex]}</span>
                    </div>
                    <button
                      onClick={() => cycleClassicIndex(1)}
                      className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm text-white text-2xl flex items-center justify-center hover:bg-white/30 transition-colors border border-white/20 flex-shrink-0"
                    >
                      →
                    </button>
                  </div>
                  <div className="text-center mb-4">
                    <span className="text-white/80 text-xs uppercase tracking-wider mr-2">Total:</span>
                    <span className="text-white/80 text-xs uppercase tracking-wider font-black">${totalTipped}</span>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Cards UI Grid - cards mode only */}
      {uiMode === 'cards' && (
        <div className="relative z-10 w-full h-[100dvh] overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
          {/* Responsive container with controlled spacing to avoid scroll on mobile */}
          <div 
            className="flex flex-col items-center w-full px-4 h-full"
            style={{ 
              paddingTop: isIOS 
                ? 'calc(env(safe-area-inset-top) + 1.5rem)' 
                : 'calc(env(safe-area-inset-top) + 0.75rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 3.5rem)'
            }}
          >
            {/* Title with profile picture */}
            <div className="flex items-center justify-center gap-3 mb-4 w-full">
              {deviceInfo?.profilePhotoUrl && (
                <img
                  src={deviceInfo?.profilePhotoUrl}
                  alt="Performer"
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/30 flex-shrink-0"
                />
              )}
              <h1 className="text-2xl font-bold text-white truncate">
                  Tip {deviceInfo?.stageName || `${deviceInfo?.ownerFirstName} ${deviceInfo?.ownerLastName}`}
              </h1>
            </div>

            {/* Tip buttons grid - wraps naturally */}
            <div className="flex flex-wrap justify-center gap-3 max-w-xl w-full -mt-1 mb-3">
              {tipAmounts.map((amount, index) => (
                <motion.button
                  key={amount}
                  onClick={() => {
                    setGridSelectedAmount(amount)
                    handleTipClick(amount)
                  }}
                  disabled={loading}
                  className={`
                    relative min-h-[6.25rem] min-w-[8.25rem] flex-1 basis-[calc(50%-0.5rem)] max-w-[10.5rem]
                    rounded-2xl bg-gradient-to-br ${cardColors[index]}
                    flex items-center justify-center font-black text-white text-4xl
                    shadow-2xl border border-white/20 overflow-hidden
                    ${loading && clickedAmount === amount ? 'scale-95' : 'active:scale-95'}
                    transition-transform duration-150 disabled:opacity-50
                  `}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse"></div>
                  
                  {/* Amount */}
                  <span className="relative z-10">${amount}</span>
                  
                  {/* Click ripple effect */}
                  {clickedAmount === amount && (
                    <motion.div
                      className="absolute inset-0 bg-white/30 rounded-2xl"
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 0.6 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Song request section - naturally flows below buttons */}
            {deviceInfo?.isAllowSongRequest && (
              <div className="w-full max-w-xl px-2 mb-3">
                {selectedSong ? (
                  <div className="bg-green-500/20 backdrop-blur-md rounded-2xl px-4 py-3 border border-green-400/30 break-words">
                    <div className="text-white text-xs font-semibold mb-2">🎵 Song Selected</div>
                    <div className="text-white/90 text-sm truncate">{selectedSong?.title}</div>
                    <div className="text-white/70 text-xs truncate">{selectedSong?.artist}</div>
                    <div className="text-white/60 text-sm mt-2 mb-2">Select a tip amount above to send your song request</div>
                    <button
                      onClick={() => setSelectedSong(null)}
                      className="text-white/70 active:text-white text-xs mt-2 underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSongSearch(true)}
                    className="w-full bg-white/10 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-white/20 active:bg-white/20 transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
                  >
                    <span>🎵</span>
                    <span>Request Song</span>
                  </button>
                )}
              </div>
            )}

            {/* Control block - naturally flows below everything */}
            <div className="w-full max-w-xl px-2 mt-auto mb-[2.25rem]">
              <div className="relative bg-black/60 backdrop-blur-md rounded-3xl p-4 w-full border border-white/20 shadow-2xl text-center">
                {/* Amount display */}
                <div className="text-center mb-2">
                  <span className="text-white/80 text-sm uppercase tracking-wider mr-2">Amount:</span>
                  <span className="font-black text-white/80 text-sm uppercase tracking-wider">
                    {gridSelectedAmount !== null ? `$${gridSelectedAmount}` : '—'}
                  </span>
                </div>

                {/* Total display */}
                <div className="text-center mb-3">
                  <span className="text-white/80 text-sm uppercase tracking-wider mr-2">Total:</span>
                  <span className="font-black text-white text-sm uppercase tracking-wider">${totalTipped}</span>
                </div>

                {/* Swipe UI toggle hidden for now */}
                <div className="hidden" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Song Search Modal */}
      <AnimatePresence>
        {showSongSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            >
              <SongCatalogSearch
                deviceUuid={deviceInfo?.uuid || ''}
                userTempId={userId}
                onSongSelect={handleSongSelect}
                onBackToTip={() => setShowSongSearch(false)}
                isVisible={showSongSearch}
                refreshKey={tipsRefreshKey}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Setup Modal */}
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
          toast.success('Payment method added successfully!')
        }}
        deviceUuid={deviceInfo?.uuid || ''}
        userId={userId}
      />

      {/* Audio Element */}
      <audio
        ref={audioRef}
        src="/cash-register.mp3"
        preload="auto"
      />
    </div>
  )
}

export default TippingInterface