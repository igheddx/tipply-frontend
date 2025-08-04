import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSpring, animated } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { toast } from 'sonner'
import PaymentSetupModal from '../components/PaymentSetupModal'
import apiService from '../services/api'

interface DeviceInfo {
  id: string
  uuid: string
  ownerFirstName: string
  ownerLastName: string
  ownerId: string
  stripeAccountId?: string
}

interface PaymentMethodsCheckResult {
  hasPaymentMethods: boolean
  paymentMethodType?: string
}

const TippingInterface: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>()
  const [currentAmount, setCurrentAmount] = useState<number>(1)
  const [totalTipped, setTotalTipped] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isPaymentSetup, setIsPaymentSetup] = useState(false)
  const [flyingCurrency, setFlyingCurrency] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [checkingPaymentMethods, setCheckingPaymentMethods] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)
  const [isMobile, setIsMobile] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  
  const currencyRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Currency denominations in order
  const denominations = [1, 5, 10, 20, 50, 100]
  const currentIndex = denominations.indexOf(currentAmount)

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

  // Generate or retrieve user ID from localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem('tipply_user_id')
    if (storedUserId) {
      setUserId(storedUserId)
    } else {
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      localStorage.setItem('tipply_user_id', newUserId)
      setUserId(newUserId)
    }
  }, [])

  // Enable audio on first user interaction
  const enableAudio = async () => {
    try {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      
      if (audioRef.current) {
        // Try to play a silent audio to enable audio context
        audioRef.current.volume = 0
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          await playPromise
        }
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.volume = 1
        setAudioEnabled(true)
        console.log('Audio enabled successfully')
      }
    } catch (error) {
      console.log('Audio enable failed:', error)
    }
  }

  // Fetch device info and check payment methods
  useEffect(() => {
    if (userId) {
      fetchDeviceInfo()
    }
  }, [userId])

  // Check payment methods after device info is loaded
  useEffect(() => {
    if (deviceInfo && userId) {
      checkPaymentMethods()
    }
  }, [deviceInfo, userId])

  // Check AWS IoT connection status
  useEffect(() => {
    const checkAwsIotStatus = async () => {
      try {
        console.log('=== CHECKING AWS IoT CONNECTION STATUS ===')
        const response = await apiService.getAwsIotStatus()
        if (response.data) {
          console.log('AWS IoT Status:', response.data)
          if (response.data.isConnected) {
            console.log('✅ AWS IoT MQTT service is CONNECTED and ready to send messages to devices')
          } else {
            console.log('❌ AWS IoT MQTT service is NOT CONNECTED - messages will not be sent to devices')
          }
        } else {
          console.log('❌ Failed to check AWS IoT status:', response.error)
        }
        console.log('=== END AWS IoT STATUS CHECK ===')
      } catch (error) {
        console.log('❌ Error checking AWS IoT status:', error)
      }
    }

    // Check status when component mounts
    checkAwsIotStatus()

    // Check status every 30 seconds
    const interval = setInterval(checkAwsIotStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchDeviceInfo = async () => {
    try {
      setLoading(true)
      console.log('Fetching device info for device ID:', deviceId)
      
      // Fetch actual device information from the backend
      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'}/api/devices/${deviceId}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Device info received:', data)
        setDeviceInfo(data)
        
        // Check if device has Stripe Connect account
        if (!data.stripeAccountId) {
          toast.error('This device is not set up for receiving tips yet')
          return
        }
      } else {
        console.error('Failed to fetch device info')
        toast.error('Device not found')
        return
      }
    } catch (error) {
      console.error('Error fetching device info:', error)
      toast.error('Error loading device information')
      return
    } finally {
      setLoading(false)
    }
  }

  const checkPaymentMethods = async () => {
    try {
      setCheckingPaymentMethods(true)
      console.log('Checking payment methods for user:', userId)
      
      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'}/api/stripe/check-payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceUuid: deviceInfo?.uuid || '',
          userId: userId
        })
      })
      
      if (response.ok) {
        const data: PaymentMethodsCheckResult = await response.json()
        console.log('Payment methods check result:', data)
        
        if (data.hasPaymentMethods) {
          console.log('User has payment methods, no setup needed')
          setIsPaymentSetup(true)
        } else {
          console.log('No payment methods found, showing setup modal')
          setShowPaymentModal(true)
        }
      } else {
        console.error('Failed to check payment methods')
        // Fallback to showing payment setup modal
        setShowPaymentModal(true)
      }
    } catch (error) {
      console.error('Error checking payment methods:', error)
      // Fallback to showing payment setup modal
      setShowPaymentModal(true)
    } finally {
      setCheckingPaymentMethods(false)
    }
  }

  const handlePaymentSetupComplete = () => {
    setIsPaymentSetup(true)
    setShowPaymentModal(false)
    toast.success('Payment method setup complete!')
  }

  // Gesture handling with react-spring
  const [springs] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    config: { mass: 1, tension: 300, friction: 30 }
  }))

  const bind = useDrag(async ({ 
    offset: [ox, oy],
    direction: [xDir, yDir],
    velocity: [vx, vy],
    cancel,
    canceled,
    distance,
    active,
    last
  }) => {
    console.log('Gesture detected:', { ox, oy, xDir, yDir, velocity: [vx, vy], distance, active, last })
    
    if (canceled || !last) return

    // Enable audio on first interaction
    if (!audioEnabled) {
      await enableAudio()
    }

    // Horizontal swipe - change denomination (simplified)
    if (Math.abs(ox) > 80) {
      console.log('Horizontal swipe detected:', xDir > 0 ? 'right' : 'left')
      if (xDir > 0) {
        // Swipe right - increase denomination
        const nextIndex = (currentIndex + 1) % denominations.length
        setCurrentAmount(denominations[nextIndex])
      } else {
        // Swipe left - decrease denomination
        const prevIndex = currentIndex === 0 ? denominations.length - 1 : currentIndex - 1
        setCurrentAmount(denominations[prevIndex])
      }
      cancel()
    }
    
    // Vertical swipe up - submit tip (simplified)
    if (yDir < 0 && Math.abs(oy) > 80) {
      console.log('Swipe up detected - submitting tip')
      if (!isAnimating) {
        handleSwipeUp()
      }
      cancel()
    }
  }, {
    filterTaps: true,
    threshold: 5,
    preventDefault: true,
    from: () => [0, 0]
  })

  const handleSwipeUp = async () => {
    if (!deviceInfo || !isPaymentSetup) {
      toast.error('Please set up payment method first')
      return
    }

    setIsAnimating(true)
    setFlyingCurrency(true)
    
    // Play cash register sound with improved reliability
    if (audioRef.current) {
      try {
        // Ensure audio context is active
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume()
        }
        
        audioRef.current.currentTime = 0
        audioRef.current.volume = 1
        audioRef.current.playbackRate = 1
        
        // Create a promise to handle the play operation
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          await playPromise
          console.log('Cash register sound played successfully')
        }
      } catch (error) {
        console.log('Audio play failed:', error)
        // Try to enable audio if it failed
        if (!audioEnabled) {
          await enableAudio()
          // Try playing again
          try {
            audioRef.current.currentTime = 0
            const retryPromise = audioRef.current.play()
            if (retryPromise !== undefined) {
              await retryPromise
              console.log('Cash register sound played on retry')
            }
          } catch (retryError) {
            console.log('Audio retry failed:', retryError)
          }
        }
      }
    }
    
    // Increment total immediately for better UX
    setTotalTipped(prev => prev + currentAmount)

    try {
      // Check AWS IoT status before submitting tip
      console.log('=== CHECKING AWS IoT STATUS BEFORE TIP SUBMISSION ===')
      const awsIotStatus = await apiService.getAwsIotStatus()
      if (awsIotStatus.data) {
        if (awsIotStatus.data.isConnected) {
          console.log('✅ AWS IoT is CONNECTED - tip will be sent to device')
        } else {
          console.log('❌ AWS IoT is NOT CONNECTED - tip will NOT be sent to device')
        }
      }
      console.log('=== END AWS IoT STATUS CHECK ===')

      // Log the MQTT payload that would be sent to the device
      const mqttPayload = {
        target_uuid: deviceInfo.uuid,
        action: "flash",
        duration: 1,
        sound: true,
        intensity: "medium",
        amount: currentAmount
      }
      console.log('=== MQTT PAYLOAD FOR DEVICE ===')
      console.log('Device UUID:', deviceInfo.uuid)
      console.log('MQTT Topic: tipply/presence/tipplyDevices')
      console.log('MQTT Payload:', JSON.stringify(mqttPayload, null, 2))
      console.log('=== END MQTT PAYLOAD ===')

      // Store tip in backend (no immediate payment processing)
      const response = await apiService.submitTip({
        deviceId: deviceInfo.uuid, // Backend expects deviceId as Guid
        userId: userId,
        amount: currentAmount,
        effect: getLightEffect(currentAmount),
        duration: 3000
      })

      if (response.data) {
        console.log('Tip stored successfully:', response.data)
        toast.success(`$${currentAmount} tip recorded!`)
        
        // Add celebration effect
        setShowCelebration(true)
        
        // Reset celebration after animation completes
        setTimeout(() => {
          setShowCelebration(false)
        }, 3000)
      } else {
        console.error('Failed to store tip:', response.error)
        toast.error(response.error || 'Failed to record tip')
      }
    } catch (error) {
      console.error('Error storing tip:', error)
      toast.error('Error recording tip')
    }

    // Reset flying animation after delay (1 second faster)
    setTimeout(() => {
      setFlyingCurrency(false)
      setIsAnimating(false)
    }, 1000)
  }

  const getLightEffect = (amount: number): string => {
    if (amount >= 50) return 'rainbow'
    if (amount >= 20) return 'pulse'
    if (amount >= 10) return 'flash'
    return 'glow'
  }

  const getCurrencyImage = (amount: number) => {
    const images = {
      1: '/images/1dollar.png',
      5: '/images/5dollars.png',
      10: '/images/10dollars.png',
      20: '/images/20dollars.png',
      50: '/images/50dollars.png',
      100: '/images/100dollars.png'
    }
    return images[amount as keyof typeof images] || images[1]
  }

  if (loading || checkingPaymentMethods) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!deviceInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Device not found</p>
        </div>
      </div>
    )
  }

  // Show desktop warning if not on mobile
  if (!isMobile) {
    return (
      <div className="desktop-warning">
        <h1>📱 Mobile Only</h1>
        <p>This tipping interface is designed for mobile devices only. Please open this page on your smartphone or tablet for the best experience.</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-green-50 to-blue-50 fullscreen" style={{
      width: '100vw',
      height: '100vh',
      minHeight: '-webkit-fill-available',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)'
    }}>
      {/* Audio element for cash register sound */}
      <audio ref={audioRef} preload="auto">
        <source src="/sound/cashRegisterSound.mp3" type="audio/mpeg" />
      </audio>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-white/30 backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-1 text-white drop-shadow-lg">
            💝 Tip {deviceInfo.ownerFirstName} {deviceInfo.ownerLastName}
          </h1>
          <p className="text-sm text-gray-800 font-medium drop-shadow-lg">
            Swipe to change amount • Swipe up to tip
          </p>
        </div>
      </div>

      {/* Payment Setup Modal */}
      <PaymentSetupModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onComplete={handlePaymentSetupComplete}
        deviceUuid={deviceInfo?.uuid || ''}
        userId={userId}
      />

      {/* Currency Display */}
      <div className="absolute inset-0 w-full h-full" style={{
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}>
        <animated.div
          ref={currencyRef}
          {...bind()}
          style={{
            ...springs,
            width: '100%',
            height: '100%',
            cursor: 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
            position: 'relative',
            zIndex: 5
          }}
          className="relative w-full h-full touch-manipulation"
          onTouchStart={() => console.log('Touch start detected')}
          onTouchMove={() => console.log('Touch move detected')}
          onTouchEnd={() => console.log('Touch end detected')}
        >
          <AnimatePresence>
                          <motion.div
                key={currentAmount}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative w-full h-full"
              >
              {/* Main Currency Image with Exit Animation */}
              <motion.img
                key={`${currentAmount}-${flyingCurrency ? 'flying' : 'static'}`}
                src={getCurrencyImage(currentAmount)}
                alt={`$${currentAmount} bill`}
                className="w-full h-full object-cover min-w-full min-h-full"
                style={{ 
                  width: '100vw', 
                  height: '100vh',
                  objectFit: 'cover',
                  objectPosition: 'center'
                }}
                draggable={false}
                initial={{ 
                  y: 0,
                  scale: 1,
                  opacity: 1,
                  rotate: 0
                }}
                animate={{ 
                  y: flyingCurrency ? -2000 : 0,
                  scale: flyingCurrency ? 0.6 : 1,
                  opacity: flyingCurrency ? 0 : 1,
                  rotate: flyingCurrency ? 720 : 0,
                  x: flyingCurrency ? Math.random() * 200 - 100 : 0
                }}
                transition={{ 
                  duration: flyingCurrency ? 1.5 : 0.3,
                  ease: flyingCurrency ? "easeInOut" : "easeOut"
                }}
              />

              {/* New Currency Sliding In */}
              {flyingCurrency && (
                <motion.img
                  src={getCurrencyImage(currentAmount)}
                  alt={`$${currentAmount} bill`}
                  className="absolute inset-0 w-full h-full object-cover min-w-full min-h-full"
                  style={{ 
                    width: '100vw', 
                    height: '100vh',
                    objectFit: 'cover',
                    objectPosition: 'center'
                  }}
                  draggable={false}
                  initial={{ 
                    y: 2000,
                    scale: 0.5,
                    opacity: 0,
                    rotate: -180
                  }}
                  animate={{ 
                    y: 0,
                    scale: 1,
                    opacity: 1,
                    rotate: 0
                  }}
                  transition={{ 
                    duration: 1.5,
                    ease: "easeOut",
                    delay: 0.8
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </animated.div>
      </div>

      {/* Amount Indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg">
          <span className="text-2xl font-bold text-green-600">
            ${currentAmount}
          </span>
        </div>
      </div>

      {/* Total Tipped Indicator - Always Show */}
      <div className="absolute top-20 right-4 z-10">
        <motion.div 
          className="bg-green-500/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg"
          animate={totalTipped > 0 ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5 }}
        >
          <span className="text-white text-sm font-medium">
            Total: ${totalTipped}
          </span>
        </motion.div>
      </div>

      {/* Celebration Elements */}
      {showCelebration && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              initial={{
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 50,
                opacity: 1,
                scale: 0
              }}
              animate={{
                y: -100,
                opacity: [1, 1, 0],
                scale: [0, 1, 0.8],
                rotate: [0, 360]
              }}
              transition={{
                duration: 2,
                delay: i * 0.1,
                ease: "easeOut"
              }}
              onAnimationComplete={() => {
                if (i === 7) setShowCelebration(false)
              }}
            >
              {i % 2 === 0 ? '💵' : '💝'}
            </motion.div>
          ))}
        </div>
      )}

      {/* Swipe Instructions */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
          <span className="text-white text-sm">
            ← Swipe to change • ↑ Swipe to tip
          </span>
        </div>
      </div>

      {/* Visual Swipe Indicators */}
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
        <div className="bg-blue-500/50 backdrop-blur-sm rounded-full p-2">
          <span className="text-white text-xs">←</span>
        </div>
      </div>
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10">
        <div className="bg-blue-500/50 backdrop-blur-sm rounded-full p-2">
          <span className="text-white text-xs">→</span>
        </div>
      </div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="bg-green-500/50 backdrop-blur-sm rounded-full p-2">
          <span className="text-white text-xs">↑</span>
        </div>
      </div>
    </div>
  )
}

export default TippingInterface 