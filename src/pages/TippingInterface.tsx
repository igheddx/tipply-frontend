import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSpring, animated } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { toast } from 'sonner'
import PaymentSetupModal from '../components/PaymentSetupModal'
import SongCatalogSearch from '../components/SongCatalogSearch'
import apiService from '../services/api'
import { getApiBaseUrl } from '../utils/config'

interface DeviceInfo {
  id: string
  uuid: string
  ownerFirstName: string
  ownerLastName: string
  ownerId: string
  stripeAccountId?: string
  isAllowSongRequest?: boolean
}

interface PaymentMethodsCheckResult {
  hasPaymentMethods: boolean
  paymentMethodType?: string
}

// Extended HTMLElement interface for vendor-prefixed fullscreen methods
interface ExtendedHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
  msRequestFullscreen?: () => Promise<void>
  mozRequestFullScreen?: () => Promise<void>
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
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false)
  
  // Song request state
  const [showSongSearch, setShowSongSearch] = useState(false)
  const [selectedSong, setSelectedSong] = useState<{id: string, title: string, artist: string, requestorName?: string, note?: string} | null>(null)
  
  const currencyRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Currency denominations in order
  const denominations = [1, 5, 10, 20, 50, 100]
  const currentIndex = denominations.indexOf(currentAmount)

  // Manage body overflow for tipping interface
  useEffect(() => {
    // Prevent scrolling on the tipping interface
    document.body.style.overflow = 'hidden'
    
    return () => {
      // Restore scrolling when component unmounts
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
  
  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      // Update hasEnteredFullscreen when fullscreen is entered
      if (document.fullscreenElement || 
          (document as any).webkitFullscreenElement || 
          (document as any).mozFullScreenElement || 
          (document as any).msFullscreenElement) {
        setHasEnteredFullscreen(true)
        console.log('✅ Fullscreen entered successfully')
      } else {
        // Fullscreen was exited
        setHasEnteredFullscreen(false)
        console.log('❌ Fullscreen exited')
      }
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])
  
  // Function to activate fullscreen - only call this once per session
  const activateFullscreen = async () => {
    if (hasEnteredFullscreen) {
      console.log('Already in fullscreen mode')
      return
    }
    
    try {
      const elem = document.documentElement as ExtendedHTMLElement
      console.log('Attempting to activate fullscreen for mobile...')
      
      if (elem.webkitRequestFullscreen) {
        // Safari/iOS prefers webkitRequestFullscreen
        await elem.webkitRequestFullscreen()
      } else if (elem.requestFullscreen) {
        await elem.requestFullscreen()
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen()
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen()
      } else {
        console.log('Fullscreen API not supported on this device')
      }
    } catch (error) {
      console.log('Fullscreen activation failed:', error)
      // Don't set hasEnteredFullscreen to false here, let the fullscreen change event handle it
    }
  }

  // Function to exit fullscreen
  const exitFullscreen = async () => {
    try {
      if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen()
      } else if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen()
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen()
      }
    } catch (error) {
      console.log('Exit fullscreen failed:', error)
    }
  }
  
  // Simple fullscreen activation on first swipe - only for mobile
  useEffect(() => {
    if (!isMobile || hasEnteredFullscreen) return
    
    let touchStartY = 0
    let touchStartX = 0
    let hasAttemptedFullscreen = false
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
      touchStartX = e.touches[0].clientX
    }
    
    const handleTouchEnd = async (e: TouchEvent) => {
      if (hasAttemptedFullscreen) return // Only try once
      
      const touchEndY = e.changedTouches[0].clientY
      const touchEndX = e.changedTouches[0].clientX
      
      const deltaY = touchStartY - touchEndY
      const deltaX = touchStartX - touchEndX
      
      // Only trigger fullscreen on significant swipe (not taps)
      if (Math.abs(deltaY) > 100 || Math.abs(deltaX) > 100) {
        hasAttemptedFullscreen = true
        console.log('First significant swipe detected, activating fullscreen...')
        await activateFullscreen()
      }
    }
    
    // Listen for touch events
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMobile, hasEnteredFullscreen])

  // Generate or retrieve user ID from localStorage and get proper UUID from backend
  useEffect(() => {
    const initializeUser = async () => {
      // First get or create the temporary ID
      let tempUserId = localStorage.getItem('tipply_user_id')
      if (!tempUserId) {
        tempUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
        localStorage.setItem('tipply_user_id', tempUserId)
      }

      try {
        // Get the proper User UUID from the backend
        const response = await fetch(`${getApiBaseUrl()}/api/songcatalog/user/${tempUserId}`)
        if (response.ok) {
          const userData = await response.json()
          setUserId(userData.userId)
          console.log('User initialized:', { tempId: tempUserId, userId: userData.userId })
        } else {
          console.error('Failed to get user UUID from backend')
          // Fallback to temp ID (will cause errors but better than nothing)
          setUserId(tempUserId)
        }
      } catch (error) {
        console.error('Error initializing user:', error)
        // Fallback to temp ID
        setUserId(tempUserId)
      }
    }

    initializeUser()
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

  // Initial payment method check when component mounts
  useEffect(() => {
    // If we have both device info and user ID, check payment methods immediately
    if (deviceInfo && userId && !checkingPaymentMethods) {
      checkPaymentMethods()
    }
  }, []) // Empty dependency array to run only once on mount

  // Check AWS IoT connection status
  useEffect(() => {
    const checkAwsIotStatus = async () => {
      try {
        console.log('=== CHECKING AWS IoT CONNECTION STATUS ===')
        const response = await apiService.getAwsIotStatus()
        if (response.data) {
          console.log('Full AWS IoT Status Response:', JSON.stringify(response.data, null, 2))
          console.log('=== CERTIFICATE DETAILS ===')
          console.log('Cert Files Exist:', response.data.certFilesExist)
          console.log('Cert Path:', response.data.certPath)
          console.log('Certificate Exists:', response.data.certificateExists)
          console.log('Private Key Exists:', response.data.privateKeyExists)
          console.log('Root CA Exists:', response.data.rootCaExists)
          console.log('=== END CERTIFICATE DETAILS ===')
          if (response.data.isConnected) {
            console.log('✅ AWS IoT MQTT service is CONNECTED and ready to send messages to devices')
          } else {
            console.log('❌ AWS IoT MQTT service is NOT CONNECTED - messages will not be sent to devices')
            console.log('❌ Connection Error Details:', response.data.message || 'No error message provided')
            console.log('❌ Timestamp:', response.data.timestamp || 'No timestamp')
            console.log('❌ Certificate Files Exist:', response.data.certFilesExist)
            console.log('❌ Certificate Path:', response.data.certPath)
                      console.log('❌ Certificate Exists:', response.data.certificateExists)
          console.log('❌ Private Key Exists:', response.data.privateKeyExists)
          console.log('❌ Root CA Exists:', response.data.rootCaExists)
          if (response.data.connectionError) {
            console.log('❌ AWS IoT Connection Error:', response.data.connectionError)
          }
          }
        } else {
          console.log('❌ Failed to check AWS IoT status:', response.error)
          console.log('❌ Full error response:', response)
        }
        console.log('=== END AWS IoT STATUS CHECK ===')
      } catch (error: unknown) {
        console.log('❌ Error checking AWS IoT status:', error)
        if (error instanceof Error) {
          console.log('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          })
        } else {
          console.log('❌ Unknown error type:', error)
        }
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
      const response = await fetch(`${getApiBaseUrl()}/api/devices/${deviceId}`)
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
      
      const response = await fetch(`${getApiBaseUrl()}/api/stripe/check-payment-methods`, {
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
          setShowPaymentModal(false)
        } else {
          console.log('No payment methods found, showing setup modal immediately')
          setIsPaymentSetup(false)
          setShowPaymentModal(true)
        }
      } else {
        console.error('Failed to check payment methods')
        // Fallback to showing payment setup modal
        setIsPaymentSetup(false)
        setShowPaymentModal(true)
      }
    } catch (error) {
      console.error('Error checking payment methods:', error)
      // Fallback to showing payment setup modal
      setIsPaymentSetup(false)
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

  const handleSongSelect = (song: {id: string, title: string, artist: string, requestorName?: string, note?: string}) => {
    setSelectedSong(song)
    setShowSongSearch(false)
    toast.success(`Song "${song.title}" selected! Now choose your tip amount and swipe up.`)
  }

  // AWS IoT connection test function - commented out for production but available for troubleshooting
  /* const testAwsIotConnection = async () => {
    try {
      console.log('=== MANUAL AWS IoT CONNECTION TEST ===')
      const response = await fetch('https://uhxejjh8s1.execute-api.us-east-1.amazonaws.com/dev/api/tips/test-mqtt-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      console.log('Manual test result:', result)
      
      if (result.success && result.connected) {
        toast.success('AWS IoT is connected and working!')
        console.log('✅ AWS IoT connection test successful!')
      } else {
        toast.error('AWS IoT connection failed: ' + (result.message || 'Unknown error'))
        console.log('❌ AWS IoT connection test failed:', result)
      }
    } catch (error) {
      console.error('Manual test error:', error)
      toast.error('Test failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  } */

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

    // Horizontal swipe - change denomination (left/right)
    if (Math.abs(ox) > 60) { // Reduced threshold for better mobile responsiveness
      console.log('Horizontal swipe detected:', xDir > 0 ? 'right' : 'left')
      if (xDir > 0) {
        // Swipe right - increase denomination
        const nextIndex = (currentIndex + 1) % denominations.length
        setCurrentAmount(denominations[nextIndex])
        console.log('Swipe right - amount changed to:', denominations[nextIndex])
      } else {
        // Swipe left - decrease denomination
        const prevIndex = currentIndex === 0 ? denominations.length - 1 : currentIndex - 1
        setCurrentAmount(denominations[prevIndex])
        console.log('Swipe left - amount changed to:', denominations[prevIndex])
      }
      cancel()
    }
    
    // Vertical swipe up - submit tip
    if (yDir < 0 && Math.abs(oy) > 60) { // Reduced threshold for better mobile responsiveness
      console.log('Swipe up detected - submitting tip')
      if (!isAnimating && !checkingPaymentMethods) {
        // Check if payment method is set up before allowing tip submission
        if (!isPaymentSetup) {
          console.log('No payment method setup, showing payment modal')
          setShowPaymentModal(true)
          toast.info('Please set up a payment method first')
          return
        }
        handleSwipeUp()
      }
      cancel()
    }
  }, {
    filterTaps: true,
    threshold: 10, // Increased threshold to prevent accidental triggers
    preventDefault: false, // Keep false for better fullscreen compatibility
    from: () => [0, 0],
    rubberband: true, // Keep rubberband effect for better feel
    bounds: { left: -150, right: 150, top: -150, bottom: 150 } // Reduced bounds for better control
  })

  const handleSwipeUp = async () => {
    if (!deviceInfo) {
      toast.error('Device information not loaded yet')
      return
    }

    if (checkingPaymentMethods) {
      toast.info('Please wait while we check your payment methods...')
      return
    }

    if (!isPaymentSetup) {
      console.log('No payment method setup, showing payment modal')
      setShowPaymentModal(true)
      toast.info('Please set up a payment method first')
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
      // Check AWS IoT status in background (non-blocking)
      console.log('=== CHECKING AWS IoT STATUS (NON-BLOCKING) ===')
      
      // First, try the manual connection test
      fetch('https://uhxejjh8s1.execute-api.us-east-1.amazonaws.com/dev/api/tips/test-mqtt-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(r => r.json())
      .then(testResult => {
        console.log('=== MANUAL MQTT CONNECTION TEST RESULT ===')
        console.log('Test Result:', JSON.stringify(testResult, null, 2))
        if (testResult.success && testResult.connected) {
          console.log('✅ MANUAL TEST: AWS IoT is CONNECTED and working!')
        } else {
          console.log('❌ MANUAL TEST: AWS IoT connection failed:', testResult.message)
          if (testResult.error) {
            console.log('❌ Error details:', testResult.error)
            console.log('❌ Error type:', testResult.errorType)
          }
        }
        console.log('=== END MANUAL MQTT CONNECTION TEST ===')
      })
      .catch(testError => {
        console.log('❌ Manual MQTT test failed:', testError)
      })
      
      // Then check the regular status
      apiService.getAwsIotStatus().then(awsIotStatus => {
        if (awsIotStatus.data) {
          console.log('Full AWS IoT Status Response:', JSON.stringify(awsIotStatus.data, null, 2))
          console.log('=== CERTIFICATE DETAILS ===')
          console.log('Cert Files Exist:', awsIotStatus.data.certFilesExist)
          console.log('Cert Path:', awsIotStatus.data.certPath)
          console.log('Certificate Exists:', awsIotStatus.data.certificateExists)
          console.log('Private Key Exists:', awsIotStatus.data.privateKeyExists)
          console.log('Root CA Exists:', awsIotStatus.data.rootCaExists)
          console.log('=== END CERTIFICATE DETAILS ===')
          if (awsIotStatus.data.isConnected) {
            console.log('✅ AWS IoT is CONNECTED - tip will be sent to device')
          } else {
            console.log('❌ AWS IoT is NOT CONNECTED - tip will NOT be sent to device')
            console.log('❌ Connection Error Details:', awsIotStatus.data.message || 'No error message provided')
            console.log('❌ Timestamp:', awsIotStatus.data.timestamp || 'No timestamp')
            console.log('❌ Certificate Files Exist:', awsIotStatus.data.certFilesExist)
            console.log('❌ Certificate Path:', awsIotStatus.data.certPath)
            console.log('❌ Certificate Exists:', awsIotStatus.data.certificateExists)
            console.log('❌ Private Key Exists:', awsIotStatus.data.privateKeyExists)
            console.log('❌ Root CA Exists:', awsIotStatus.data.rootCaExists)
            if (awsIotStatus.data.connectionError) {
              console.log('❌ AWS IoT Connection Error:', awsIotStatus.data.connectionError)
            }
          }
        } else {
          console.log('❌ Failed to get AWS IoT status:', awsIotStatus.error)
          console.log('❌ Full error response:', awsIotStatus)
        }
        console.log('=== END AWS IoT STATUS CHECK ===')
      }).catch(error => {
        console.log('❌ AWS IoT status check failed:', error)
      })

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
        
        // If a song was selected, create the song request entry
        if (selectedSong) {
          try {
            const songRequestResponse = await fetch(`${getApiBaseUrl()}/api/songcatalog/request`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                deviceUuid: deviceInfo?.uuid,
                songId: selectedSong.id,
                participantId: userId,
                tipAmount: currentAmount,
                requestorName: selectedSong.requestorName,
                note: selectedSong.note
              })
            })

            if (songRequestResponse.ok) {
              console.log('Song request created successfully')
              toast.success(`$${currentAmount} tip recorded with song "${selectedSong.title}"!`)
            } else {
              console.error('Failed to create song request')
              toast.success(`$${currentAmount} tip recorded!`)
              toast.error('Song request failed to save')
            }
          } catch (error) {
            console.error('Error creating song request:', error)
            toast.success(`$${currentAmount} tip recorded!`)
            toast.error('Song request failed to save')
          }
        } else {
          toast.success(`$${currentAmount} tip recorded!`)
        }
        
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
    <div 
      data-route="tipping"
      className="tipping-interface-fullscreen relative w-full h-screen overflow-hidden bg-gradient-to-br from-green-50 to-blue-50" 
      style={{
      width: '100vw',
      height: '100vh',
      minHeight: '-webkit-fill-available',
      margin: 0,
      padding: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }}>
      {/* Audio element for cash register sound */}
      <audio ref={audioRef} preload="auto">
        <source src="/sound/cashRegisterSound.mp3" type="audio/mpeg" />
      </audio>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-white/30 backdrop-blur-sm">
        <div className="text-center">
          {selectedSong && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 bg-purple-600/90 backdrop-blur-sm rounded-lg px-3 py-1 mx-auto inline-block"
            >
              <span className="text-white text-sm font-medium">
                🎵 {selectedSong.title} by {selectedSong.artist}
              </span>
            </motion.div>
          )}
          <h1 className="text-xl font-bold mb-1 text-white drop-shadow-lg">
            💝 Tip {deviceInfo.ownerFirstName} {deviceInfo.ownerLastName}
          </h1>
          
          {/* Fullscreen Status Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 flex items-center justify-center gap-2"
          >
            {hasEnteredFullscreen ? (
              <div className="bg-green-600/90 backdrop-blur-sm rounded-lg px-3 py-1 inline-flex items-center gap-2">
                <span className="text-white text-sm font-medium">🖥️ Fullscreen Active</span>
                <button
                  onClick={exitFullscreen}
                  className="text-white/80 hover:text-white text-xs px-2 py-1 rounded border border-white/30 hover:bg-white/20 transition-colors"
                >
                  Exit
                </button>
              </div>
            ) : (
              <div className="bg-gray-600/90 backdrop-blur-sm rounded-lg px-3 py-1 inline-flex items-center gap-2">
                <span className="text-white text-sm font-medium">📱 Swipe to enter fullscreen</span>
                {isMobile && (
                  <button
                    onClick={activateFullscreen}
                    className="text-white/80 hover:text-white text-xs px-2 py-1 rounded border border-white/30 hover:bg-white/20 transition-colors"
                  >
                    Tap to Enter
                  </button>
                )}
              </div>
            )}
          </motion.div>

          <p className="text-sm text-gray-800 font-medium drop-shadow-lg">
            Swipe to change amount • Swipe up to tip
          </p>

          {/* Payment Method Check Status */}
          {checkingPaymentMethods && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 bg-blue-600/90 backdrop-blur-sm rounded-lg px-3 py-1 mx-auto inline-block"
            >
              <span className="text-white text-sm font-medium">
                🔄 Checking payment methods...
              </span>
            </motion.div>
          )}

          {/* Payment Setup Required Indicator */}
          {!checkingPaymentMethods && !isPaymentSetup && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 bg-orange-600/90 backdrop-blur-sm rounded-lg px-3 py-1 mx-auto inline-block"
            >
              <span className="text-white text-sm font-medium">
                💳 Payment method required
              </span>
            </motion.div>
          )}

          {/* Payment Setup Instructions */}
          {!checkingPaymentMethods && !isPaymentSetup && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 mx-auto inline-block max-w-xs cursor-pointer hover:bg-white/95 transition-colors"
              onClick={() => setShowPaymentModal(true)}
            >
              <p className="text-gray-800 text-xs text-center leading-relaxed">
                Tap here to set up your payment method and start tipping!
              </p>
            </motion.div>
          )}

          {/* Debug button for testing AWS IoT - Hidden for production but available for troubleshooting */}
          {/* <button
            onClick={testAwsIotConnection}
            className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600 transition-colors"
          >
            Test AWS IoT
          </button> */}
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
        width: '100vw',
        height: '100vh',
        minHeight: '-webkit-fill-available',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        padding: 0
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
            touchAction: 'manipulation', // Changed from 'none' to 'manipulation' for better fullscreen compatibility
            position: 'relative',
            zIndex: 5,
            WebkitTouchCallout: 'none', // Prevent callout on iOS
            WebkitTapHighlightColor: 'transparent' // Remove tap highlight
          }}
          className="relative w-full h-full touch-manipulation"
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
                  minHeight: '-webkit-fill-available',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  margin: 0,
                  padding: 0,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0
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
                    minHeight: '-webkit-fill-available',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    margin: 0,
                    padding: 0,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0
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

      {/* Song Request Button - Only show if device allows song requests */}
      {deviceInfo?.isAllowSongRequest && !showSongSearch && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-20 left-4 z-10"
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSongSearch(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm text-sm flex items-center space-x-1.5 hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span>🎵 Request song</span>
          </motion.button>
        </motion.div>
      )}

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

      {/* Song Catalog Search Component */}
      <SongCatalogSearch
        deviceUuid={deviceInfo?.uuid || ''}
        userTempId={userId}
        onSongSelect={handleSongSelect}
        onBackToTip={() => setShowSongSearch(false)}
        isVisible={showSongSearch}
      />
    </div>
  )
}

export default TippingInterface 