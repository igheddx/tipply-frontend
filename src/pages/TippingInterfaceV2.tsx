import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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

const TippingInterfaceV2: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>()
  const [totalTipped, setTotalTipped] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isPaymentSetup, setIsPaymentSetup] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [checkingPaymentMethods, setCheckingPaymentMethods] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [clickedAmount, setClickedAmount] = useState<number | null>(null)
  
  // Song request state
  const [showSongSearch, setShowSongSearch] = useState(false)
  const [selectedSong, setSelectedSong] = useState<{id: string, title: string, artist: string, requestorName?: string, note?: string} | null>(null)
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

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

  // Manage body overflow
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  // Initialize user
  useEffect(() => {
    const initializeUser = async () => {
      let tempUserId = localStorage.getItem('tipply_user_id')
      if (!tempUserId) {
        tempUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
        localStorage.setItem('tipply_user_id', tempUserId)
      }

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/songcatalog/user/${tempUserId}`)
        if (response.ok) {
          const userData = await response.json()
          setUserId(userData.userId)
        } else {
          setUserId(tempUserId)
        }
      } catch (error) {
        setUserId(tempUserId)
      }
    }

    initializeUser()
  }, [])

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
      console.log('Audio enable failed:', error)
    }
  }

  // Fetch device info and check payment methods
  useEffect(() => {
    const fetchDeviceData = async () => {
      if (!deviceId) return
      
      try {
        const deviceResponse = await fetch(`${getApiBaseUrl()}/api/devices/${deviceId}`)
        if (!deviceResponse.ok) {
          toast.error('Device not found')
          return
        }
        
        const device = await deviceResponse.json()
        setDeviceInfo({
          id: device.id,
          uuid: device.uuid,
          ownerFirstName: device.ownerFirstName,
          ownerLastName: device.ownerLastName,
          ownerId: device.profileId,
          stripeAccountId: device.stripeAccountId,
          isAllowSongRequest: device.isAllowSongRequest
        })

        // Check AWS IoT status
        try {
          const response = await apiService.getAwsIotStatus()
          console.log('AWS IoT Status:', response)
        } catch (error) {
          console.log('AWS IoT Status check failed:', error)
        }

        // Check payment methods
        const paymentCheck = await checkPaymentMethods()
        setIsPaymentSetup(paymentCheck.hasPaymentMethods)
        setCheckingPaymentMethods(false)

      } catch (error) {
        console.error('Error fetching device data:', error)
        toast.error('Failed to load device information')
        setCheckingPaymentMethods(false)
      }
    }

    fetchDeviceData()
  }, [deviceId])

  const checkPaymentMethods = async (): Promise<PaymentMethodsCheckResult> => {
    const tempUserId = localStorage.getItem('tipply_user_id')
    if (!tempUserId) {
      return { hasPaymentMethods: false }
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/stripe/payment-methods/${tempUserId}`)
      const data = await response.json()
      
      if (response.ok && data.hasPaymentMethods) {
        return {
          hasPaymentMethods: true,
          paymentMethodType: data.paymentMethodType
        }
      }
    } catch (error) {
      console.log('Payment method check failed:', error)
    }
    
    return { hasPaymentMethods: false }
  }

  const getLightEffect = (amount: number): string => {
    if (amount >= 100) return 'rainbow'
    if (amount >= 50) return 'gold'
    if (amount >= 20) return 'purple'
    if (amount >= 10) return 'blue'
    if (amount >= 5) return 'green'
    return 'white'
  }

  const handleTipClick = async (amount: number) => {
    if (loading || !deviceInfo || !userId) return

    // Enable audio on first interaction
    if (!audioEnabled) {
      await enableAudio()
    }

    // If song is selected, this completes the song request
    if (selectedSong) {
      await processTipWithSong(amount)
      return
    }

    // Regular tip
    await processTip(amount)
  }

  const processTip = async (amount: number) => {
    setLoading(true)
    setClickedAmount(amount)
    
    // Show confetti immediately
    setShowCelebration(true)
    
    // Update total
    setTotalTipped(prev => prev + amount)

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
      const response = await apiService.submitTip({
        deviceId: deviceInfo!.uuid,
        userId: userId,
        amount: amount,
        effect: getLightEffect(amount),
        duration: 3000
      })

      if (response.data) {
        toast.success(`$${amount} tip submitted!`)
      } else {
        toast.error('Failed to submit tip. Please try again.')
        setTotalTipped(prev => prev - amount)
      }
    } catch (error) {
      console.error('Error submitting tip:', error)
      toast.error('Failed to submit tip. Please try again.')
      setTotalTipped(prev => prev - amount)
    }

    setLoading(false)
    setClickedAmount(null)
  }

  const processTipWithSong = async (amount: number) => {
    setLoading(true)
    setClickedAmount(amount)
    setShowCelebration(true)
    setTotalTipped(prev => prev + amount)

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
      // Submit tip
      const response = await apiService.submitTip({
        deviceId: deviceInfo!.uuid,
        userId: userId,
        amount: amount,
        effect: getLightEffect(amount),
        duration: 3000
      })

      if (response.data) {
        // Submit song request
        await fetch(`${getApiBaseUrl()}/api/songcatalog/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceUuid: deviceInfo?.uuid,
            songId: selectedSong!.id,
            participantId: userId,
            tipAmount: amount,
            requestorName: selectedSong!.requestorName,
            note: selectedSong!.note
          })
        })

        toast.success(`$${amount} tip with song request submitted!`)
        setSelectedSong(null)
        setShowSongSearch(false)
      } else {
        toast.error('Failed to submit tip. Please try again.')
        setTotalTipped(prev => prev - amount)
      }
    } catch (error) {
      console.error('Error submitting tip with song:', error)
      toast.error('Failed to submit tip. Please try again.')
      setTotalTipped(prev => prev - amount)
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

  if (!isPaymentSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-6">💳</div>
          <h2 className="text-2xl font-bold text-white mb-4">Payment Setup Required</h2>
          <p className="text-white/80 mb-6">Set up your payment method to start tipping!</p>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:scale-105 transition-transform"
          >
            Set Up Payment
          </button>
        </div>

        <PaymentSetupModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setIsPaymentSetup(true)
            setShowPaymentModal(false)
            toast.success('Payment method added successfully!')
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Background Effects */}
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

      {/* Header */}
      <div className="relative z-10 pt-8 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2"
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            Tip {deviceInfo?.ownerFirstName} {deviceInfo?.ownerLastName}
          </h1>
          <p className="text-white/70">Choose an amount to show your appreciation!</p>
        </motion.div>

        {/* Total Tipped Display */}
        <motion.div
          className="inline-flex items-center bg-white/10 backdrop-blur-md rounded-full px-6 py-2 mt-4"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span className="text-white/70 text-sm">Total Tipped: </span>
          <span className="text-white font-bold text-lg ml-2">${totalTipped}</span>
        </motion.div>
      </div>

      {/* Tip Amount Cards */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="grid grid-cols-2 gap-6 max-w-lg w-full">
          {tipAmounts.map((amount, index) => (
            <motion.button
              key={amount}
              onClick={() => handleTipClick(amount)}
              disabled={loading}
              className={`
                relative h-32 rounded-2xl bg-gradient-to-br ${cardColors[index]}
                flex items-center justify-center font-black text-white text-3xl
                shadow-2xl border border-white/20 overflow-hidden
                ${loading && clickedAmount === amount ? 'scale-95' : 'hover:scale-105'}
                transition-all duration-200 disabled:opacity-50
              `}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileTap={{ scale: 0.95 }}
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
      </div>

      {/* Song Request Section */}
      {deviceInfo?.isAllowSongRequest && (
        <div className="relative z-10 px-6 pb-8">
          <div className="text-center">
            {selectedSong ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/20 backdrop-blur-md rounded-xl p-4 mb-4"
              >
                <div className="text-white font-semibold">🎵 Song Selected:</div>
                <div className="text-white/90">{selectedSong.title} by {selectedSong.artist}</div>
                <div className="text-white/70 text-sm mt-2">Select a tip amount to send your request!</div>
                <button
                  onClick={() => setSelectedSong(null)}
                  className="text-white/70 hover:text-white text-sm mt-2 underline"
                >
                  Cancel song request
                </button>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowSongSearch(true)}
                className="bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/20 transition-colors flex items-center justify-center mx-auto"
              >
                <span className="mr-2">🎵</span>
                Request a Song
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confetti Animation */}
      <AnimatePresence>
        {showCelebration && (
          <div className="absolute inset-0 pointer-events-none z-50">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl"
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: window.innerHeight + 50,
                  opacity: 1,
                  scale: 0,
                  rotate: 0
                }}
                animate={{
                  y: -100,
                  opacity: [1, 1, 0],
                  scale: [0, 1.2, 0.8],
                  rotate: [0, 180 + Math.random() * 180]
                }}
                transition={{
                  duration: 1.2,
                  delay: i * 0.05,
                  ease: "easeOut"
                }}
                onAnimationComplete={() => {
                  if (i === 11) setShowCelebration(false)
                }}
              >
                {['🎉', '💰', '⭐', '🎵', '💝', '🔥'][i % 6]}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

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
                userId={userId}
                onSongSelect={handleSongSelect}
                onClose={() => setShowSongSearch(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Setup Modal */}
      <PaymentSetupModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setIsPaymentSetup(true)
          setShowPaymentModal(false)
          toast.success('Payment method added successfully!')
        }}
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

export default TippingInterfaceV2