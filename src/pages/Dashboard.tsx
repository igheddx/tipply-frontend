import logger from "../utils/logger";
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import SongManagement from '../components/SongManagement'
import SongRequestMonitor from '../components/SongRequestMonitor'
import { API_BASE_URL } from '../utils/config'
import { CrownOutlined } from '@ant-design/icons'

interface DashboardStats {
  totalDevices: number
  activeDevices: number
  totalTipsReceived: number
  totalTipsCount: number
  todayTipsReceived: number
  todayTipsCount: number
  thisWeekTipsReceived: number
  thisWeekTipsCount: number
  thisMonthTipsReceived: number
  thisMonthTipsCount: number
  devices: DeviceSummary[]
  recentTips: TipSummary[]
}

interface DashboardMetrics {
  totalEarnings: number
  pendingPayouts: number
  pendingTips: number
  todaysTips: number
  thisWeekTips: number
  thisWeekTipsCount: number
  thisMonthTips: number
  lastMonthTips: number
  trendPercentage: number
  trendDirection: string
  stripeAvailableBalance: number
  stripeFuturePayouts: number
  stripeInTransit: number
  stripeLifetimeVolume: number
}

interface DeviceSummary {
  id: string
  uuid: string
  nickname: string
  isOnline: boolean
  totalTipsReceived: number
  totalTipsCount: number
  lastTipReceived: string
  qrCodeUrl: string
  isAllowSongRequest: boolean
  isSoundEnabled?: boolean
  isRandomLightEffect?: boolean
  effectConfiguration?: string
}

interface TipSummary {
  id: string
  amount: number
  deviceNickname: string
  createdAt: string
  status: string
}

interface Device {
  id: string
  uuid: string
  nickname: string
  stripeAccountId?: string
  deletedAt?: string
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentTips, setRecentTips] = useState<TipSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showStripeAlert, setShowStripeAlert] = useState(false)
  const [stripeEnabledDevices, setStripeEnabledDevices] = useState<string[]>([])
  const [userProfile, setUserProfile] = useState<any>(null)
  const [stripeMetricsLoading, setStripeMetricsLoading] = useState(true)
  
  const getDeviceSetupUrl = () => {
    const host = window.location.hostname.toLowerCase()
    if (host.includes('apptest')) {
      return 'https://apptest.tipwave.live/device-setup'
    }
    return 'https://app.tipwave.live/device-setup'
  }
  
  // Add Device Form States
  const [showAddDeviceForm, setShowAddDeviceForm] = useState(false)
  const [addDeviceForm, setAddDeviceForm] = useState({
    serialNumber: '', // Changed from deviceUuid to serialNumber
    nickname: '',
    isAllowSongRequest: null as boolean | null
  })
  const [addDeviceErrors, setAddDeviceErrors] = useState<{[key: string]: string}>({})
  const [isAddingDevice, setIsAddingDevice] = useState(false)
  const [isValidatingAddDevice, setIsValidatingAddDevice] = useState(false)
  const [addDeviceValidationComplete, setAddDeviceValidationComplete] = useState(false)
  const [validatedDeviceUuid, setValidatedDeviceUuid] = useState<string>('')
  const [validatedSerialNumber, setValidatedSerialNumber] = useState<string>('')
  const [showStripeSetup, setShowStripeSetup] = useState(false)
  
  // Soft Delete States
  const [deletedDevices, setDeletedDevices] = useState<Device[]>([])
  const [showDeletedDevices, setShowDeletedDevices] = useState(false)
  const [isDeletingDevice, setIsDeletingDevice] = useState<string | null>(null)
  const [isRestoringDevice, setIsRestoringDevice] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceSummary | null>(null)
  
  // Song Request Toggle States
  const [updatingSongRequest, setUpdatingSongRequest] = useState<string | null>(null)
  
  // Device Configuration States
  const [expandedDeviceConfig, setExpandedDeviceConfig] = useState<string | null>(null)
  const [updatingDeviceConfig, setUpdatingDeviceConfig] = useState<string | null>(null)
  
  // Song Request Monitoring States
  const [showMonitorFullscreen, setShowMonitorFullscreen] = useState(false)
  const [songRequests, setSongRequests] = useState<any[]>([])
  
  // Song Catalog Alert States
  const [showSongCatalogAlert, setShowSongCatalogAlert] = useState(false)
  const [songCatalogCount, setSongCatalogCount] = useState(0)
  
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token')
    if (!token) {
      logger.log('No authentication token found, redirecting to login')
      navigate('/login')
      return
    }

    // Fetch only profile and overview data on init - lazy-load tab data when selected
    const initDashboard = async () => {
      try {
        const startTime = performance.now()
        logger.log('🚀 [PERF] Dashboard init started')
        setLoading(true)
        
        // Get profile first
        let profileTime = performance.now()
        const profileResp = await apiService.getProfile()
        logger.log(`⏱️ [PERF] getProfile() took ${(performance.now() - profileTime).toFixed(0)}ms`)
        
        if (profileResp.error?.includes('401')) {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          navigate('/login')
          return
        }
        
        if (!profileResp.data) {
          setLoading(false)
          return
        }
        
        setUserProfile(profileResp.data)
        const profileId = profileResp.data.id
        logger.log(`✅ [PERF] User profile set: ${profileId}`)

        // ONLY fetch overview data on init (stats, metrics)
        // Time them individually to find the real bottleneck
        let statsTime = performance.now()
        const statsResp = await apiService.getDashboardStats()
        logger.log(`⏱️ [PERF] getDashboardStats() alone took ${(performance.now() - statsTime).toFixed(0)}ms`)

        let metricsTime = performance.now()
        // Fast path: skip Stripe metrics on initial load to avoid blocking UI
        const metricsResp = await apiService.getDashboardMetrics(profileId, { skipStripe: true })
        logger.log(`⏱️ [PERF] getDashboardMetrics(skipStripe=true) took ${(performance.now() - metricsTime).toFixed(0)}ms`)

        if (statsResp.data) {
          setStats(statsResp.data)
          logger.log(`✅ [PERF] Stats set: ${statsResp.data.devices?.length || 0} devices`)
        }

        if (metricsResp.data) {
          setMetrics(metricsResp.data)
          logger.log('✅ [PERF] Metrics set (without Stripe)')
        }

        // Check song catalog alert in background
        if (statsResp.data?.devices) {
          const devicesWithSongRequests = statsResp.data.devices.filter((device: DeviceSummary) => device.isAllowSongRequest)
          if (devicesWithSongRequests.length > 0) {
            try {
              let catalogTime = performance.now()
              const catalogResp = await fetch(`${API_BASE_URL}/api/songcatalog/my-songs/${profileId}`)
              if (catalogResp.ok) {
                const catalogData = await catalogResp.json()
                const count = catalogData.length || 0
                setSongCatalogCount(count)
                logger.log(`⏱️ [PERF] Song catalog check took ${(performance.now() - catalogTime).toFixed(0)}ms`)
                
                if (count === 0) {
                  const alertDismissed = localStorage.getItem(`songCatalogAlertDismissed_${profileId}`)
                  if (!alertDismissed) {
                    setShowSongCatalogAlert(true)
                  }
                }
              }
            } catch (error) {
              logger.error('Error checking song catalog:', error)
            }
          }
        }

        // Don't wait for Stripe check - do it in background after loading complete
        // This was blocking the init!
        if (profileResp.data.stripeAccountId) {
          let stripeTime = performance.now()
          apiService.getDevices()
            .then(devicesResp => {
              if (devicesResp.data?.length > 0) {
                return apiService.getConnectAccountStatus(devicesResp.data[0].uuid)
                  .then(statusResp => {
                    if (statusResp.data) {
                      const verificationStatus = statusResp.data.VerificationStatus || statusResp.data.verificationStatus || 'unknown'
                      if (verificationStatus.toLowerCase() === 'verified') {
                        setStripeEnabledDevices(devicesResp.data.map((d: any) => d.uuid))
                      }
                    }
                    logger.log(`⏱️ [PERF] Background Stripe check took ${(performance.now() - stripeTime).toFixed(0)}ms`)
                  })
              }
            })
            .catch(error => logger.error('Error checking Stripe status:', error))
        }

        setLoading(false)
        logger.log(`🎉 [PERF] Dashboard init complete in ${(performance.now() - startTime).toFixed(0)}ms`)

        // Background fetch: load Stripe metrics and merge into state when ready
        try {
          const stripeStart = performance.now()
          setStripeMetricsLoading(true)
          const fullMetrics = await apiService.getDashboardMetrics(profileId, { skipStripe: false })
          if (fullMetrics.data) {
            setMetrics(prev => prev ? {
              ...prev,
              stripeAvailableBalance: fullMetrics.data.stripeAvailableBalance ?? prev.stripeAvailableBalance,
              stripeFuturePayouts: fullMetrics.data.stripeFuturePayouts ?? prev.stripeFuturePayouts,
              stripeInTransit: fullMetrics.data.stripeInTransit ?? prev.stripeInTransit,
              stripeLifetimeVolume: fullMetrics.data.stripeLifetimeVolume ?? prev.stripeLifetimeVolume,
              totalEarnings: fullMetrics.data.totalEarnings ?? prev.totalEarnings,
              pendingPayouts: fullMetrics.data.pendingPayouts ?? prev.pendingPayouts,
            } : fullMetrics.data)
            logger.log(`⏱️ [PERF] Background Stripe metrics loaded in ${(performance.now() - stripeStart).toFixed(0)}ms`)
          }
        } catch (e) {
          logger.warn('Skipping Stripe metrics due to error:', e)
        } finally {
          setStripeMetricsLoading(false)
        }
      } catch (error) {
        logger.error('Error initializing dashboard:', error)
        setLoading(false)
        setStripeMetricsLoading(false)
      }
    }

    initDashboard()
  }, [navigate])

  // Refresh data when tab changes
  useEffect(() => {
    if (!userProfile?.id) return

    const refreshData = async () => {
      const profileId = userProfile.id
      
      switch (activeTab) {
        case 'overview':
          // Avoid redundant heavy call: if we already have metrics, skip.
          // If not loaded yet (e.g., direct tab switch), fetch fast path without Stripe.
          if (!metrics) {
            const metricsResp = await apiService.getDashboardMetrics(profileId, { skipStripe: true })
            if (metricsResp.data) setMetrics(metricsResp.data)
          }
          break
          
        case 'devices':
          // Lazy-load devices tab data if not already loaded
          if (!stats?.devices) {
            const statsResp = await apiService.getDashboardStats()
            if (statsResp.data) setStats(statsResp.data)
          }
          break
          
        case 'tips':
          // Lazy-load tips if not already loaded
          if (recentTips.length === 0) {
            const tipsResp = await apiService.getRecentTips(profileId)
            if (tipsResp.data) {
              setRecentTips(tipsResp.data.map((tip: any) => ({
                id: tip.id,
                amount: tip.amount,
                deviceNickname: 'Device',
                createdAt: tip.createdAt,
                status: tip.status
              })))
            }
          }
          break
          
        case 'deletedDevices':
          // Lazy-load deleted devices if not already loaded
          if (deletedDevices.length === 0) {
            const deletedResp = await apiService.getDeletedDevices()
            if (deletedResp.data) setDeletedDevices(deletedResp.data)
          }
          break
          
        case 'monitor':
          loadSongRequests()
          break
          
        default:
          break
      }
    }

    refreshData()
  }, [activeTab, userProfile?.id, stats?.devices, recentTips.length, deletedDevices.length])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    navigate('/login')
  }

  // Removed checkKycResult function

  // Optimized refresh function that doesn't make redundant getProfile() calls
  const refreshDashboard = async () => {
    try {
      setLoading(true)
      setStripeMetricsLoading(true)
      
      // Only fetch what actually changed - don't re-fetch profile
      // Just refresh the volatile data: stats, metrics, tips, deleted devices, devices
      const profileId = userProfile?.id
      if (!profileId) {
        logger.warn('No profile ID available for refresh')
        return
      }

      // Parallelize all refreshes at once
      const [statsResp, metricsResp, tipsResp, deletedResp, devicesResp] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.getDashboardMetrics(profileId),
        apiService.getRecentTips(profileId),
        apiService.getDeletedDevices(),
        apiService.getDevices()
      ])

      if (statsResp.data) {
        setStats(statsResp.data)
      }

      if (metricsResp.data) {
        setMetrics(metricsResp.data)
      }

      if (tipsResp.data) {
        setRecentTips(tipsResp.data.map((tip: any) => ({
          id: tip.id,
          amount: tip.amount,
          deviceNickname: 'Device',
          createdAt: tip.createdAt,
          status: tip.status
        })))
      }

      if (deletedResp.data) {
        setDeletedDevices(deletedResp.data)
      }

      // Update Stripe status if we have devices
      if (userProfile?.stripeAccountId && devicesResp.data?.length > 0) {
        try {
          const statusResp = await apiService.getConnectAccountStatus(devicesResp.data[0].uuid)
          if (statusResp.data) {
            const verificationStatus = statusResp.data.VerificationStatus || statusResp.data.verificationStatus || 'unknown'
            if (verificationStatus.toLowerCase() === 'verified') {
              setStripeEnabledDevices(devicesResp.data.map((d: any) => d.uuid))
            }
          }
        } catch (error) {
          logger.error('Error checking Stripe status on refresh:', error)
        }
      }

      logger.log('✅ Dashboard refresh complete')
    } catch (error) {
      logger.error('Error refreshing dashboard:', error)
    } finally {
      setLoading(false)
      setStripeMetricsLoading(false)
    }
  }

  const dismissStripeAlert = () => {
    setShowStripeAlert(false)
  }

  const dismissSongCatalogAlert = () => {
    if (userProfile?.id) {
      localStorage.setItem(`songCatalogAlertDismissed_${userProfile.id}`, 'true')
    }
    setShowSongCatalogAlert(false)
  }

  // Add Device Functions
  const handleAddDeviceClick = () => {
    setShowAddDeviceForm(true)
    setActiveTab('addDevice')
  }

  const handleStripeConnect = async () => {
    if (!userProfile) {
      setAddDeviceErrors({ submit: 'User profile not found. Please refresh and try again.' })
      return
    }

    if (!validatedDeviceUuid || !validatedSerialNumber) {
      setAddDeviceErrors({ submit: 'Device UUID not found. Please validate the device serial number first.' })
      return
    }

    logger.log('🔍 [DEBUG] Using validated device UUID for Stripe Connect:', validatedDeviceUuid)
    logger.log('🔍 [DEBUG] Using validated serial number for Stripe Connect:', validatedSerialNumber)

    setIsAddingDevice(true)
    try {
      logger.log('Starting Stripe Connect setup for authenticated user:', userProfile.email)
      logger.log('Using validated device UUID:', validatedDeviceUuid)
      logger.log('Using validated serial number:', validatedSerialNumber)
      
      const token = localStorage.getItem('token')
      logger.log('Token exists:', !!token)
      logger.log('Token length:', token?.length || 0)
      
      // Decode token to check role and expiry
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          logger.log('Token payload:', payload)
          logger.log('User role:', payload.role)
          logger.log('Token expires:', new Date(payload.exp * 1000))
        } catch (e) {
          logger.error('Error decoding token:', e)
        }
      }
      
      // Use the UUID-based endpoint with JWT authentication
      // The UUID comes from the device validation step
      const result = await apiService.createConnectAccountForUser(validatedDeviceUuid, validatedSerialNumber)
      
      logger.log('CreateConnectAccount response:', result)

      if (result.error) {
        throw new Error(result.error)
      }

      // Check if device already has Stripe Connect account (inherited)
      if (result.data?.requiresOnboarding === false) {
        logger.log('Device already linked to existing Stripe account:', result.data.stripeAccountId)
        logger.log('Success:', result.data.message || 'Device successfully linked to existing Stripe account!')
        
        // Refresh the devices list to show the updated device
        await refreshDashboard()
        setActiveTab('devices')
        return // Exit early - no onboarding needed
      }

      // Handle new Stripe account creation - requires onboarding
      if (result.data?.onboardingUrl && result.data?.requiresOnboarding !== false) {
        logger.log('Redirecting to Stripe onboarding URL:', result.data.onboardingUrl)
        window.location.href = result.data.onboardingUrl
        return // Exit early since we're redirecting
      } 
      
      // Check if we got an async processing response (fallback)
      if (result.data?.status === 'processing') {
        logger.log('Received processing status, but we need serial number for polling...')
        logger.log('This case might need additional handling for UUID-based polling')
        throw new Error('Async processing not yet supported for UUID-based requests')
      }
      
      // If no clear response, this is an error
      throw new Error('Unexpected response from Stripe Connect setup')

    } catch (error) {
      logger.error('Error setting up Stripe Connect:', error)
      setAddDeviceErrors({ submit: `Failed to setup Stripe Connect: ${error instanceof Error ? error.message : 'Unknown error'}` })
    } finally {
      setIsAddingDevice(false)
    }
  }



  const handleBackToDashboard = () => {
    setShowAddDeviceForm(false)
    setShowStripeSetup(false)
    setActiveTab('overview')
    setAddDeviceForm({ serialNumber: '', nickname: '', isAllowSongRequest: null })
    setAddDeviceErrors({})
    setAddDeviceValidationComplete(false)
    setIsValidatingAddDevice(false)
    setValidatedDeviceUuid('')
    setValidatedSerialNumber('')
  }

  const handleAddDeviceInputChange = (field: string, value: string) => {
    setAddDeviceForm(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (addDeviceErrors[field]) {
      setAddDeviceErrors(prev => ({ ...prev, [field]: '' }))
    }
    
    // Reset device validation state when device UUID changes
    if (field === 'serialNumber') {
      setAddDeviceValidationComplete(false)
      setIsValidatingAddDevice(false)
      setValidatedDeviceUuid('')
      setValidatedSerialNumber('')
    }
  }

  const validateAddDeviceForm = () => {
    const errors: {[key: string]: string} = {}
    
    if (!addDeviceForm.serialNumber.trim()) {
      errors.serialNumber = 'Serial Number is required'
    }
    
    if (!addDeviceForm.nickname.trim()) {
      errors.nickname = 'Device nickname is required'
    }
    
    if (addDeviceForm.isAllowSongRequest === null) {
      errors.isAllowSongRequest = 'Please select whether to enable song requests'
    }
    
    setAddDeviceErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateAddDeviceDetectedDevice = async () => {
    const serialNumber = addDeviceForm.serialNumber.trim()
    
    if (!serialNumber) {
      return { isValid: false, error: 'Serial Number is required' }
    }
    
    setIsValidatingAddDevice(true)
    setAddDeviceValidationComplete(false)
    
    try {
      const result = await apiService.checkDetectedDeviceBySerialNumber(serialNumber)
      
      if (result.error) {
        const errorMessage = result.error || 'Failed to validate serial number'
        setAddDeviceErrors(prev => ({ ...prev, serialNumber: errorMessage }))
        setAddDeviceValidationComplete(true)
        setIsValidatingAddDevice(false)
        return { isValid: false, error: errorMessage }
      }
      
      if (!result.data?.exists) {
        const errorMessage = result.data?.message || 'Serial Number not found or device is not available for registration'
        setAddDeviceErrors(prev => ({ ...prev, serialNumber: errorMessage }))
        setAddDeviceValidationComplete(true)
        setIsValidatingAddDevice(false)
        setValidatedDeviceUuid('')
        setValidatedSerialNumber('')
        return { isValid: false, error: errorMessage }
      }
      
      // Store the validated device UUID and serial number
      const deviceUuid = result.data?.detectedDevice?.uuid
      if (deviceUuid) {
        setValidatedDeviceUuid(deviceUuid)
        setValidatedSerialNumber(serialNumber) // Store the serial number we used for validation
      }
      
      // Clear any existing errors
      setAddDeviceErrors(prev => ({ ...prev, serialNumber: '' }))
      setAddDeviceValidationComplete(true)
      setIsValidatingAddDevice(false)
      return { isValid: true, error: null, deviceUuid }
    } catch (err) {
      const errorMessage = 'Failed to validate serial number'
      setAddDeviceErrors(prev => ({ ...prev, serialNumber: errorMessage }))
      setAddDeviceValidationComplete(true)
      setIsValidatingAddDevice(false)
      return { isValid: false, error: errorMessage }
    }
  }

  const handleAddDeviceSubmit = async () => {
    if (!validateAddDeviceForm()) {
      return
    }

    // Validate device exists in DetectedDevices table
    if (!addDeviceValidationComplete || !!addDeviceErrors.serialNumber) {
      // Re-validate if not already validated
      if (addDeviceForm.serialNumber.trim()) {
        const validation = await validateAddDeviceDetectedDevice()
        if (!validation.isValid) {
          return
        }
      } else {
        setAddDeviceErrors(prev => ({ ...prev, serialNumber: 'Serial Number is required' }))
        return
      }
    }

    setIsAddingDevice(true)
    try {
      // Add the device directly - no need to check KYC/Stripe status first
      // Users can add devices (including soft-deleted ones) at any time
      // The backend will enforce authorization
      await addDeviceToUser()
      
    } catch (error) {
      logger.error('Error adding device:', error)
      setAddDeviceErrors({ submit: 'Failed to add device. Please try again.' })
    } finally {
      setIsAddingDevice(false)
    }
  }

  const addDeviceToUser = async () => {
    try {
      const response = await apiService.addDevice({
        serialNumber: addDeviceForm.serialNumber,
        nickname: addDeviceForm.nickname,
        isAllowSongRequest: addDeviceForm.isAllowSongRequest || false
      })
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      // Check if Stripe setup is required
      if (response.data?.requiresStripeSetup) {
        // Device added but needs Stripe Connect setup
        logger.log('Device added, Stripe setup required:', response.data.stripeSetupMessage)
        
        // Show the existing Stripe setup flow
        setShowStripeSetup(true)
        return
      }

      // Success! Device added and ready (either inherited Stripe or no Stripe needed)
      logger.log('✅ Device added successfully:', response.data)
      
      // Clear form first
      setShowAddDeviceForm(false)
      setAddDeviceForm({ serialNumber: '', nickname: '', isAllowSongRequest: null })
      setAddDeviceErrors({})
      setAddDeviceValidationComplete(false)
      setIsValidatingAddDevice(false)
      setValidatedDeviceUuid('')
      setValidatedSerialNumber('')
      
      // Force a complete refresh with single efficient call
      logger.log('🔄 Refreshing dashboard stats...')
      await refreshDashboard()
      
      // Switch to devices tab to show the newly added device
      setActiveTab('devices')
      
      logger.log('✅ Refresh complete. Device should now be visible.')
      
    } catch (error) {
      logger.error('Error adding device:', error)
      setAddDeviceErrors({ submit: 'Failed to add device. Please try again.' })
    }
  }

  const downloadQRCode = async (deviceId: string, nickname: string) => {
    try {
      console.info('[QR] Download clicked', { deviceId, nickname })

      // Always fetch QR as a blob from API to avoid cross-origin issues
      const qrBlob = await apiService.downloadQRCode(deviceId)
      if (!qrBlob) {
        alert('Could not download QR code. Please try again or check your connection.')
        return
      }

      if (!qrBlob.type.startsWith('image/')) {
        alert(`QR download returned a non-image content-type: ${qrBlob.type || 'unknown'}`)
        return
      }

      // Some environments return base64 PNG text with image/png header. Try to normalize it to real binary before decoding.
      let sourceBlob: Blob = qrBlob
      if (qrBlob.size < 10000) {
        try {
          const possibleBase64 = (await qrBlob.text()).trim()
          const isLikelyBase64Png = possibleBase64.startsWith('iVBORw0KGgo') && /^[A-Za-z0-9+/=\n\r]+$/.test(possibleBase64)
          if (isLikelyBase64Png) {
            const byteChars = atob(possibleBase64)
            const byteNumbers = new Array(byteChars.length)
            for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
            const byteArray = new Uint8Array(byteNumbers)
            sourceBlob = new Blob([byteArray], { type: 'image/png' })
            console.info('[QR] Detected base64 PNG response; converted to binary', { originalSize: qrBlob.size, binarySize: sourceBlob.size })
          }
        } catch (decodeErr) {
          logger.warn('[QR] Base64 normalization failed; using original blob', decodeErr)
        }
      }

      const qrBlobUrl = URL.createObjectURL(sourceBlob)
      let qrBitmap: ImageBitmap
      try {
        qrBitmap = await createImageBitmap(sourceBlob)
      } catch (err) {
        const blobSize = sourceBlob.size
        let snippet = ''
        try {
          const text = await sourceBlob.text()
          snippet = text.slice(0, 200)
        } catch (e) {
          snippet = '[unreadable]'
        }
        logger.error('[QR] Bitmap decode failed', { err, blobType: sourceBlob.type, blobSize, snippet })

        // Fallback: download raw QR blob so user still gets the code
        const rawUrl = URL.createObjectURL(sourceBlob)
        const a = document.createElement('a')
        a.href = rawUrl
        a.download = `tipwave-qr-${nickname || deviceId}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(rawUrl)
        alert('Could not generate the branded card because the QR image could not be decoded. Downloaded the raw QR instead.')
        return
      }

      // Get stage name from profile
      const stageName = userProfile?.stageName || userProfile?.firstName || 'Performer'

      // Create a canvas for the 4x6 card (4in x 6in at 300 DPI = 1200 x 1800 px)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const width = 1200
      const height = 1800
      canvas.width = width
      canvas.height = height

      // White background for print efficiency
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)

      // Load Tipwave logo
      const logo = new Image()
      logo.crossOrigin = 'anonymous'
      logo.src = '/images/logo/tipwave-logo2b.png?v=20260208'

      // Wait for logo (optional)
      await new Promise((resolve) => { logo.onload = resolve; logo.onerror = resolve })
      console.info('[QR] QR bitmap ready', { width: qrBitmap.width, height: qrBitmap.height })

      // Draw header
      const headerBarHeight = 260
      ctx.fillStyle = '#111111'
      ctx.fillRect(0, 0, width, headerBarHeight)
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 118px Arial, sans-serif'
      ctx.textAlign = 'center'
      const headerTextY = 165
      const headerText = '🎵 TIP THE PERFORMER'
      const headerMaxWidth = width - 40
      const headerTextWidth = ctx.measureText(headerText).width
      const headerScaleX = headerTextWidth > headerMaxWidth ? headerMaxWidth / headerTextWidth : 1
      ctx.save()
      ctx.translate(width / 2, 0)
      ctx.scale(headerScaleX, 1)
      ctx.fillText(headerText, 0, headerTextY)
      ctx.restore()

      // Draw QR code (centered, 12% larger) with thick black border
      try {
        if (!qrBitmap.width || !qrBitmap.height) {
          throw new Error('QR image is empty or failed to load')
        }
        const qrSize = 672
        const borderSize = 42
        const qrX = (width - qrSize) / 2
        const qrY = 330
        ctx.fillStyle = '#111111'
        ctx.fillRect(qrX - borderSize, qrY - borderSize, qrSize + borderSize * 2, qrSize + borderSize * 2)
        ctx.drawImage(qrBitmap, qrX, qrY, qrSize, qrSize)
      } catch (err) {
        logger.error('[QR] Draw failed, falling back to raw QR download', err)
        const rawUrl = URL.createObjectURL(qrBlob)
        const a = document.createElement('a')
        a.href = rawUrl
        a.download = `tipwave-qr-${nickname || deviceId}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(rawUrl)
        alert('Could not render the branded card. Downloaded the raw QR instead.')
        return
      }

      // Tagline under QR (small and supportive)
      ctx.fillStyle = '#374151'
      ctx.font = '24px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Scan to tip instantly', width / 2, 1280)

      // Instruction line under QR
      ctx.fillStyle = '#111827'
      ctx.font = '26px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Scan. Choose how to pay. Tap to tip.', width / 2, 1320)

      // Trust line with padlock icon
      const trustText = 'Secure payments powered by Stripe'
      ctx.font = '22px Arial, sans-serif'
      ctx.fillStyle = '#4B5563'
      const textWidth = ctx.measureText(trustText).width
      const lockSize = 18
      const lockGap = 10
      const trustY = 1360
      const lockX = (width / 2) - (textWidth / 2) - lockGap - lockSize
      const lockY = trustY - lockSize + 2

      // Draw minimal padlock icon
      ctx.strokeStyle = '#4B5563'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(lockX, lockY + 6, lockSize, lockSize - 4, 3)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(lockX + lockSize / 2, lockY + 6, lockSize / 3.2, Math.PI, 0)
      ctx.stroke()
      ctx.fillText(trustText, width / 2, trustY)

      // Draw performer name
      ctx.fillStyle = '#111827'
      ctx.font = 'italic 42px Arial, sans-serif'
      ctx.fillText(stageName, width / 2, 1525)

      // Draw logo at bottom-right (aligned with footer region)
      if (logo.complete && logo.naturalHeight > 0) {
        const logoHeight = 320
        const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight
        const padding = 40
        const logoX = width - logoWidth - padding
        const logoY = 1540
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight)
      }

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `tipwave-card-${nickname || deviceId}.png`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          window.URL.revokeObjectURL(qrBlobUrl)
          document.body.removeChild(a)
        }
      }, 'image/png')
    } catch (error) {
      logger.error('Error generating QR card:', error)
      alert(`Could not generate the QR card. ${error instanceof Error ? error.message : 'Please try again.'}`)
    }
  }

  const fetchDeletedDevices = async () => {
    try {
      const response = await apiService.getDeletedDevices()
      if (response.data) {
        setDeletedDevices(response.data)
      }
    } catch (error) {
      logger.error('Error fetching deleted devices:', error)
    }
  }

  const handleSoftDeleteDevice = async (device: DeviceSummary) => {
    setDeviceToDelete(device)
    setShowDeleteModal(true)
  }

  const confirmDeleteDevice = async () => {
    if (!deviceToDelete) return

    setIsDeletingDevice(deviceToDelete.id)
    try {
      const response = await apiService.softDeleteDevice(deviceToDelete.id)
      if (response.data) {
        // Refresh both active and deleted devices
        await refreshDashboard()
        setShowDeleteModal(false)
        setDeviceToDelete(null)
      } else {
        alert('Failed to delete device: ' + (response.error || 'Unknown error'))
      }
    } catch (error) {
      logger.error('Error deleting device:', error)
      alert('Error deleting device')
    } finally {
      setIsDeletingDevice(null)
    }
  }

  const cancelDeleteDevice = () => {
    setShowDeleteModal(false)
    setDeviceToDelete(null)
  }

  const handleRestoreDevice = async (deviceId: string) => {
    setIsRestoringDevice(deviceId)
    try {
      const response = await apiService.restoreDevice(deviceId)
      if (response.data) {
        // Refresh both active and deleted devices
        await refreshDashboard()
      } else {
        alert('Failed to restore device: ' + (response.error || 'Unknown error'))
      }
    } catch (error) {
      logger.error('Error restoring device:', error)
      alert('Error restoring device')
    } finally {
      setIsRestoringDevice(null)
    }
  }

  const toggleDeletedDevices = () => {
    setShowDeletedDevices(!showDeletedDevices)
    if (!showDeletedDevices) {
      fetchDeletedDevices()
    }
  }

  const toggleSongRequestSetting = async (device: DeviceSummary) => {
    setUpdatingSongRequest(device.id)
    try {
      const newSetting = !device.isAllowSongRequest
      
      const response = await apiService.updateSongRequestSetting(device.id, newSetting)

      if (response.data) {
        // Update the device in the stats state
        setStats(prevStats => {
          if (!prevStats) return prevStats
          return {
            ...prevStats,
            devices: prevStats.devices.map(d => 
              d.id === device.id 
                ? { ...d, isAllowSongRequest: newSetting }
                : d
            )
          }
        })
      } else {
        alert('Failed to update song request setting: ' + (response.error || 'Unknown error'))
      }
    } catch (error) {
      logger.error('Error updating song request setting:', error)
      alert('Error updating song request setting')
    } finally {
      setUpdatingSongRequest(null)
    }
  }

  const updateDeviceConfiguration = async (
    deviceId: string,
    isSoundEnabled: boolean,
    isRandomLightEffect: boolean,
    effectConfig: Record<string, string>
  ) => {
    setUpdatingDeviceConfig(deviceId)
    try {
      logger.log('📤 Sending device configuration update:', { deviceId, isSoundEnabled, isRandomLightEffect, effectConfig })
      const response = await apiService.updateDeviceConfiguration(deviceId, {
        isSoundEnabled,
        isRandomLightEffect,
        effectConfiguration: JSON.stringify(effectConfig)
      })

      logger.log('📥 Device configuration response:', response)
      if (response.data && response.data.success) {
        logger.log('✅ Device configuration updated successfully:', response.data)
        // Update the device in the stats state immediately
        setStats(prevStats => {
          if (!prevStats) return prevStats
          logger.log('📝 Before state update - devices:', prevStats.devices.map(d => ({ id: d.id, sound: d.isSoundEnabled, random: d.isRandomLightEffect })))
          const newDevices = prevStats.devices.map(d => {
            if (d.id === deviceId) {
              logger.log(`✏️ Updating device ${d.id}: sound ${d.isSoundEnabled} → ${isSoundEnabled}, random ${d.isRandomLightEffect} → ${isRandomLightEffect}`)
              return { ...d, isSoundEnabled, isRandomLightEffect, effectConfiguration: JSON.stringify(effectConfig) }
            } else {
              logger.log(`⏭️ Skipping device ${d.id} (not matching ${deviceId})`)
              return d
            }
          })
          logger.log('📝 After state update - devices:', newDevices.map(d => ({ id: d.id, sound: d.isSoundEnabled, random: d.isRandomLightEffect })))
          return {
            ...prevStats,
            devices: newDevices
          }
        })
        // Don't refetch - trust the local state and the server response which confirmed the update
        logger.log('✅ Device configuration persisted in state. Skipping refetch to avoid race conditions.')
      } else {
        logger.error('❌ Failed to update device configuration - response:', response)
        logger.error('Response data:', response.data)
        logger.error('Response error:', response.error)
        logger.error('Response status:', response.status)
        alert('Failed to update device configuration: ' + (response.error || 'Unknown error'))
      }
    } catch (error) {
      logger.error('❌ Error updating device configuration:', error)
      logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
      alert('Error updating device configuration: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingDeviceConfig(null)
    }
  }

  const getEffectConfig = (device: DeviceSummary): Record<string, string> => {
    logger.log(`🎨 Getting effect config for device ${device.id}:`, device.effectConfiguration)
    try {
      if (device.effectConfiguration) {
        const parsed = JSON.parse(device.effectConfiguration)
        logger.log(`✅ Parsed effect config:`, parsed)
        return parsed
      }
    } catch (e) {
      logger.error('❌ Error parsing effect configuration:', e, 'Raw value:', device.effectConfiguration)
    }
    // Default configuration
    logger.log('⚠️ Using default effect config for device', device.id)
    return {
      "2": "effect1",
      "5": "effect1",
      "10": "effect2",
      "20": "effect2",
      "50": "effect3",
      "100": "effect3"
    }
  }

  const loadSongRequests = async () => {
    if (!userProfile?.id) return
    
    try {
      const token = localStorage.getItem('token')
      // Add cache-busting query parameter to ensure fresh data
      const cacheBuster = Date.now()
      const response = await fetch(`${API_BASE_URL}/api/SongCatalog/monitor/${userProfile.id}?_t=${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setSongRequests(data.songRequests || [])
      } else {
        const errorText = await response.text()
        logger.error(`🔴 [Dashboard Monitor] Failed to load song requests: ${response.status} ${response.statusText}`, errorText)
      }
    } catch (error) {
      logger.error('🔴 [Dashboard Monitor] Error loading song requests:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load dashboard data</p>
          <button
            onClick={refreshDashboard}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* KYC Result Alert */}
      {/* Removed KYC alert as per edit hint */}

      {/* Stripe Connect Alert */}
      {showStripeAlert && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md" style={{ top: '16px' }}>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-green-800">
                  Stripe Account Verified! 🎉
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    Your Stripe Connect account is now enabled and ready to receive payments!
                    {stripeEnabledDevices.length > 0 && (
                      <span className="block mt-1">
                        Verified devices: {stripeEnabledDevices.join(', ')}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={dismissStripeAlert}
                  className="inline-flex text-green-400 hover:text-green-600 focus:outline-none focus:text-green-600"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Header */}
              <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-[14px]">
            {/* Left side - Logo */}
            <div className="flex items-center">
              <div className="relative w-12 h-12 overflow-visible rounded-lg">
                <img
                  src="/images/logo/tipwave-logo2b.png?v=20260208"
                  alt="Tipwave Logo"
                  className="w-full h-full object-contain"
                  style={{ transform: 'scale(4)', objectPosition: 'center' }}
                />
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center space-x-4">
              {/* Admin Dashboard Button */}
              {userProfile?.role === 'root_admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center space-x-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-purple-700 hover:bg-purple-100 transition-colors"
                  title="Admin Dashboard"
                >
                  <CrownOutlined className="text-purple-700 text-lg" />
                  <span className="text-sm font-medium">Admin</span>
                </button>
              )}

              {/* Profile and Logout buttons */}
              <button
                onClick={() => navigate('/profile')}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Profile"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Logout"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message - Moved outside header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {userProfile?.firstName || userProfile?.stageName || 'Performer'}! 👋
            </h2>
            <p className="text-gray-600">
              Here's how you're connecting with your audience and building meaningful social connections today.
            </p>
            {stripeMetricsLoading && (
              <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm px-3 py-2 rounded-full border border-blue-100 shadow-sm">
                <svg className="w-4 h-4 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Updating payouts and balances...</span>
              </div>
            )}
          </div>
          <button
            onClick={() => refreshDashboard()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
            title="Refresh dashboard data"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {/* Song Catalog Alert */}
        {showSongCatalogAlert && songCatalogCount === 0 && (
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-blue-800">
                    Add Songs to Your Catalog 🎵
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      You've enabled song requests for your devices! Get started by adding songs to your catalog so your audience can request their favorites when they tip.
                    </p>
                    <button
                      onClick={() => {
                        setActiveTab('songs')
                        // Scroll to songs section after tab change
                        setTimeout(() => {
                          const songsSection = document.getElementById('songs-section')
                          if (songsSection) {
                            songsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                        }, 100) // Small delay to ensure tab change completes
                      }}
                      className="mt-2 text-blue-800 hover:text-blue-900 font-medium underline"
                    >
                      Add songs now →
                    </button>
                  </div>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={dismissSongCatalogAlert}
                    className="inline-flex text-blue-400 hover:text-blue-600 focus:outline-none focus:text-blue-600"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {/* Pending Tips Card */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 transform hover:scale-105 transition-all duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="flex-shrink-0 mb-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Pending Tips</p>
                <p className="text-lg font-bold text-gray-900 mb-1">
                  {metrics ? formatCurrency(metrics.pendingTips) : '$0.00'}
                </p>
                <p className="text-xs text-gray-600">Awaiting processing</p>
              </div>
            </div>
          </div>

          {/* Today's Tips */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 transform hover:scale-105 transition-all duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="flex-shrink-0 mb-3">
                <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Today's Tips</p>
                <p className="text-lg font-bold text-gray-900 mb-1">
                  {metrics ? formatCurrency(metrics.todaysTips) : formatCurrency(stats.todayTipsReceived)}
                </p>
                <p className="text-xs text-gray-600">
                  {metrics ? `${Math.round(metrics.todaysTips)} tips` : `${stats.todayTipsCount} tips`}
                </p>
              </div>
            </div>
          </div>

          {/* Future Payouts */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 transform hover:scale-105 transition-all duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="flex-shrink-0 mb-3">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Future Payouts</p>
                <p className="text-lg font-bold text-gray-900 mb-1">
                  {metrics ? formatCurrency(metrics.stripeFuturePayouts) : '$0.00'}
                </p>
                <p className="text-xs text-gray-600">Scheduled</p>
              </div>
            </div>
          </div>

          {/* In Transit to Bank */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 transform hover:scale-105 transition-all duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="flex-shrink-0 mb-3">
                <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">In Transit</p>
                <p className="text-lg font-bold text-gray-900 mb-1">
                  {metrics ? formatCurrency(metrics.stripeInTransit) : '$0.00'}
                </p>
                <p className="text-xs text-gray-600">To bank</p>
              </div>
            </div>
          </div>

          {/* Total Balance / Available Balance */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 transform hover:scale-105 transition-all duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="flex-shrink-0 mb-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Total Balance</p>
                <p className="text-lg font-bold text-gray-900 mb-1">
                  {metrics ? formatCurrency(metrics.stripeAvailableBalance) : '$0.00'}
                </p>
                <p className="text-xs text-gray-600">Available now</p>
              </div>
            </div>
          </div>

          {/* Lifetime Volume */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 transform hover:scale-105 transition-all duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="flex-shrink-0 mb-3">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Lifetime Volume</p>
                <p className="text-lg font-bold text-gray-900 mb-1">
                  {metrics ? formatCurrency(metrics.stripeLifetimeVolume) : '$0.00'}
                </p>
                <p className="text-xs text-gray-600">All-time</p>
              </div>
            </div>
          </div>

          {/* This Month */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 transform hover:scale-105 transition-all duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="flex-shrink-0 mb-3">
                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-center space-x-2 mb-1">
                  <p className="text-xs font-medium text-gray-700">This Month</p>
                  {metrics && metrics.trendPercentage > 0 && (
                    <div className={`flex items-center space-x-1 ${
                      metrics.trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metrics.trendDirection === 'up' ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className="text-xs font-medium">
                        {metrics.trendPercentage.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-lg font-bold text-gray-900 mb-1">
                  {metrics ? formatCurrency(metrics.thisMonthTips) : formatCurrency(stats.thisMonthTipsReceived)}
                </p>
                <p className="text-xs text-gray-600">
                  {metrics ? `${Math.round(metrics.thisMonthTips)} tips` : `${stats.thisMonthTipsCount} tips`}
                </p>
              </div>
            </div>
          </div>

          {/* Active Devices */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 transform hover:scale-105 transition-all duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="flex-shrink-0 mb-3">
                <div className="w-10 h-10 bg-fuchsia-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Active Devices</p>
                <p className="text-lg font-bold text-gray-900 mb-1">{stats.activeDevices}</p>
                <p className="text-xs text-gray-600">of {stats.totalDevices} total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {!showAddDeviceForm ? (
                <>
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'overview'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('devices')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'devices'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Devices
                  </button>
                  <button
                    onClick={() => setActiveTab('tips')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'tips'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Recent Tips
                  </button>
                  <button
                    onClick={() => setActiveTab('songs')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'songs'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Song Requests
                  </button>
                  <button
                    onClick={() => setActiveTab('monitor')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'monitor'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Monitor Song Requests
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={handleBackToDashboard}
                      className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      <span>Back to Dashboard</span>
                    </button>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Add New Device</h3>
                </div>
              )}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Performance</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">This Week</span>
                        <span className="font-semibold">
                          {metrics ? formatCurrency(metrics.thisWeekTips || 0) : formatCurrency(stats.thisWeekTipsReceived)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Tips Count</span>
                        <span className="font-semibold">
                          {metrics ? (metrics.thisWeekTipsCount || 0) : stats.thisWeekTipsCount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Average per Tip</span>
                        <span className="font-semibold">
                          {metrics && metrics.thisWeekTipsCount && metrics.thisWeekTipsCount > 0 
                            ? formatCurrency(metrics.thisWeekTips / metrics.thisWeekTipsCount)
                            : stats.thisWeekTipsCount > 0 
                            ? formatCurrency(stats.thisWeekTipsReceived / stats.thisWeekTipsCount)
                            : '$0.00'
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <button
                        onClick={handleAddDeviceClick}
                        className="w-full text-left p-3 bg-white rounded-lg border border-green-200 hover:border-green-300 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Add New Device</p>
                            <p className="text-sm text-gray-500">Register another Tipply device</p>
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => setActiveTab('devices')}
                        className="w-full text-left p-3 bg-white rounded-lg border border-green-200 hover:border-green-300 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Download QR Codes</p>
                            <p className="text-sm text-gray-500">Get QR codes for your devices</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'devices' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Your Devices</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={refreshDashboard}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Refresh Status</span>
                    </button>
                    <button
                      onClick={() => window.open(getDeviceSetupUrl(), '_blank')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      Connect Device To Wifi
                    </button>
                    <button
                      onClick={handleAddDeviceClick}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Add Device
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stats.devices.map((device) => {
                    return (
                      <div key={device.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold text-gray-900">
                                {device.nickname || 'Unnamed Device'}
                              </h4>
                            </div>
                            <p className="text-sm text-gray-500">{device.uuid}</p>
                          </div>
                          <div className={`w-3 h-3 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Total Tips</span>
                            <span className="font-medium">{device.totalTipsCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Total Earned</span>
                            <span className="font-medium">{formatCurrency(device.totalTipsReceived)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Last Tip</span>
                            <span className="font-medium">{formatDate(device.lastTipReceived)}</span>
                          </div>
                          {/* Device status hidden for now */}
                        </div>

                        <div className="space-y-2">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => downloadQRCode(device.id, device.nickname)}
                              className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                            >
                              Download QR
                            </button>
                            <button
                              onClick={() => window.open(device.qrCodeUrl, '_blank')}
                              className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleSoftDeleteDevice(device)}
                              disabled={isDeletingDevice === device.id}
                              className="px-3 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                            >
                              {isDeletingDevice === device.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                          <button
                            onClick={() => toggleSongRequestSetting(device)}
                            disabled={updatingSongRequest === device.id}
                            className={`w-full px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                              device.isAllowSongRequest
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {updatingSongRequest === device.id
                              ? 'Updating...'
                              : device.isAllowSongRequest
                              ? 'Disable Song Request'
                              : 'Enable Song Request'
                            }
                          </button>
                          
                          {/* Device Configuration Section */}
                          <button
                            onClick={() => setExpandedDeviceConfig(expandedDeviceConfig === device.id ? null : device.id)}
                            className="w-full px-3 py-2 bg-purple-100 text-purple-700 text-sm rounded-lg hover:bg-purple-200 transition-colors flex items-center justify-between"
                          >
                            <span>Device Configuration</span>
                            <svg 
                              className={`w-4 h-4 transition-transform ${expandedDeviceConfig === device.id ? 'rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Expanded Configuration Panel */}
                          {expandedDeviceConfig === device.id && (
                            <div className="mt-3 p-4 bg-white rounded-lg border border-purple-200 space-y-4">
                              {/* Sound Toggle */}
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Sound Enabled</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={device.isSoundEnabled ?? false}
                                    onChange={(e) => {
                                      const effectConfig = getEffectConfig(device)
                                      updateDeviceConfiguration(device.id, e.target.checked, device.isRandomLightEffect ?? false, effectConfig)
                                    }}
                                    disabled={updatingDeviceConfig === device.id}
                                    className="sr-only peer"
                                  />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                              </div>

                              {/* Random Light Effect Toggle */}
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Random Light Effect</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={device.isRandomLightEffect ?? false}
                                    onChange={(e) => {
                                      const effectConfig = getEffectConfig(device)
                                      updateDeviceConfiguration(device.id, device.isSoundEnabled ?? false, e.target.checked, effectConfig)
                                    }}
                                    disabled={updatingDeviceConfig === device.id}
                                    className="sr-only peer"
                                  />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                              </div>

                              {/* Effect Configuration */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Light Effects by Amount</h4>
                                {(() => {
                                  const effectConfig = getEffectConfig(device)
                                  const amounts = [2, 5, 10, 20, 50, 100]
                                  const effects = ['effect1', 'effect2', 'effect3']
                                  
                                  return amounts.map(amount => (
                                    <div key={amount} className="flex items-center justify-between text-sm">
                                      <span className="text-gray-600">${amount}</span>
                                      <select
                                        value={effectConfig[amount.toString()] || 'effect1'}
                                        onChange={(e) => {
                                          const newConfig = { ...effectConfig, [amount.toString()]: e.target.value }
                                          updateDeviceConfiguration(device.id, device.isSoundEnabled ?? false, device.isRandomLightEffect ?? false, newConfig)
                                        }}
                                        disabled={updatingDeviceConfig === device.id}
                                        className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      >
                                        {effects.map(effect => (
                                          <option key={effect} value={effect}>
                                            {effect === 'effect1' ? 'Flash' : effect === 'effect2' ? 'Swirl' : 'Breathing'}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ))
                                })()}
                              </div>

                              {updatingDeviceConfig === device.id && (
                                <div className="text-xs text-purple-600 text-center">Updating configuration...</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Deleted Devices Section */}
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Deleted Devices</h3>
                    <button
                      onClick={toggleDeletedDevices}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>{showDeletedDevices ? 'Hide' : 'Show'} Deleted Devices</span>
                    </button>
                  </div>

                  {showDeletedDevices && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {deletedDevices.length === 0 ? (
                        <div className="col-span-full text-center py-8">
                          <p className="text-gray-500">No deleted devices found.</p>
                        </div>
                      ) : (
                        deletedDevices.map((device) => (
                          <div key={device.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200 opacity-75">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">
                                    {device.nickname || 'Unnamed Device'}
                                  </h4>
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Deleted
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500">{device.uuid}</p>
                                {device.deletedAt && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Deleted on {formatDate(device.deletedAt)}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleRestoreDevice(device.id)}
                                disabled={isRestoringDevice === device.id}
                                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                {isRestoringDevice === device.id ? 'Restoring...' : 'Restore'}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {stats.devices.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No devices yet</h3>
                    <p className="text-gray-500 mb-4">Get started by adding your first Tipply device</p>
                    <button
                      onClick={handleAddDeviceClick}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Add Your First Device
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tips' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Recent Tips (Today)</h3>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Device
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {recentTips.map((tip) => (
                          <tr key={tip.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-lg font-semibold text-gray-900">
                                {formatCurrency(tip.amount)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">{tip.deviceNickname}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-500">{formatDate(tip.createdAt)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                tip.status === 'processed'
                                  ? 'bg-green-100 text-green-800'
                                  : tip.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {tip.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {recentTips.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No tips today</h3>
                    <p className="text-gray-500">Tips from today (both pending and processed) will appear here once you start receiving them</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'addDevice' && (
              <div className="space-y-6">
                {!showStripeSetup ? (
                  // Add Device Form
                  <div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Add New Device</h3>
                        <p className="text-gray-600">Enter your device details to add it to your account.</p>
                      </div>

                      <form onSubmit={(e) => { e.preventDefault(); handleAddDeviceSubmit(); }} className="space-y-6">
                        <div>
                          <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-2">
                            Serial Number *
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              id="serialNumber"
                              value={addDeviceForm.serialNumber}
                              onChange={(e) => handleAddDeviceInputChange('serialNumber', e.target.value)}
                              onBlur={async () => {
                                if (addDeviceForm.serialNumber.trim()) {
                                  await validateAddDeviceDetectedDevice()
                                }
                              }}
                              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 ${
                                addDeviceErrors.serialNumber ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
                              }`}
                              placeholder="e.g., TPY-5C07-K73"
                            />
                            {isValidatingAddDevice && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                              </div>
                            )}
                          </div>
                          {addDeviceErrors.serialNumber && (
                            <p className="text-red-500 text-sm mt-1">{addDeviceErrors.serialNumber}</p>
                          )}
                          {addDeviceValidationComplete && !addDeviceErrors.serialNumber && addDeviceForm.serialNumber.trim() && (
                            <p className="text-green-500 text-sm mt-1">✓ Serial Number validated successfully</p>
                          )}
                          <p className="text-sm text-gray-500 mt-1">
                            Enter the serial number from your Tipply device (e.g., TPY-5C07-K73)
                          </p>
                        </div>

                        <div>
                          <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-2">
                            Device Nickname *
                          </label>
                          <input
                            type="text"
                            id="nickname"
                            value={addDeviceForm.nickname}
                            onChange={(e) => handleAddDeviceInputChange('nickname', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 ${
                              addDeviceErrors.nickname ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
                            }`}
                            placeholder="e.g., Main Stage, Bar Counter, VIP Room"
                          />
                          {addDeviceErrors.nickname && (
                            <p className="text-red-500 text-sm mt-1">{addDeviceErrors.nickname}</p>
                          )}
                          <p className="text-sm text-gray-500 mt-1">
                            Give your device a friendly name for easy identification
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Would you like to enable song requests from your audience? *
                          </label>
                          <p className="text-sm text-gray-500 mb-4">
                            If you select "Yes", you'll be able to create a song catalog for your audience to choose from. This allows your audience to request specific songs when they tip you.
                          </p>
                          <div className="space-y-3">
                            <label className="flex items-center cursor-pointer p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                              <input
                                type="radio"
                                name="addDeviceIsAllowSongRequest"
                                checked={addDeviceForm.isAllowSongRequest === true}
                                onChange={() => setAddDeviceForm(prev => ({ ...prev, isAllowSongRequest: true }))}
                                className="mr-4 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                              />
                              <div>
                                <span className="text-sm font-medium text-gray-700">Yes, enable song requests</span>
                                <p className="text-xs text-gray-500 mt-1">Your audience can request songs when they tip</p>
                              </div>
                            </label>
                            <label className="flex items-center cursor-pointer p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                              <input
                                type="radio"
                                name="addDeviceIsAllowSongRequest"
                                checked={addDeviceForm.isAllowSongRequest === false}
                                onChange={() => setAddDeviceForm(prev => ({ ...prev, isAllowSongRequest: false }))}
                                className="mr-4 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                              />
                              <div>
                                <span className="text-sm font-medium text-gray-700">No, disable song requests</span>
                                <p className="text-xs text-gray-500 mt-1">Standard tipping without song requests</p>
                              </div>
                            </label>
                          </div>
                          {addDeviceErrors.isAllowSongRequest && (
                            <p className="text-red-500 text-sm mt-1">{addDeviceErrors.isAllowSongRequest}</p>
                          )}
                        </div>

                        {addDeviceErrors.submit && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-600 text-sm">{addDeviceErrors.submit}</p>
                          </div>
                        )}

                        <div className="flex space-x-4 pt-4">
                          <button
                            type="button"
                            onClick={handleBackToDashboard}
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isAddingDevice}
                            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            {isAddingDevice ? (
                              <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Adding Device...</span>
                              </>
                            ) : (
                              <span>Add Device</span>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : (
                  // Stripe Setup Required
                  <div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Stripe Setup Required</h3>
                          <p className="text-yellow-700 mb-4">
                            Before adding a new device, you need to complete your Stripe Connect account setup and KYC verification.
                          </p>
                          {addDeviceErrors.submit && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-red-700 text-sm">{addDeviceErrors.submit}</p>
                            </div>
                          )}
                          <div className="flex space-x-4">
                            <button
                              onClick={handleStripeConnect}
                              disabled={isAddingDevice}
                              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isAddingDevice ? 'Setting up...' : 'Complete Stripe Setup'}
                            </button>
                            <button
                              onClick={handleBackToDashboard}
                              className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
                            >
                              Back to Dashboard
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'songs' && (
              <div id="songs-section" className="space-y-6">
                <SongManagement profileId={userProfile?.id} />
              </div>
            )}

            {activeTab === 'monitor' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Monitor Song Requests</h2>
                    <button
                      onClick={() => setShowMonitorFullscreen(true)}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-medium flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Actively Monitor Request</span>
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {songRequests.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">No song requests today</h3>
                        <p className="text-gray-600">Song requests will appear here when participants make them through the tip interface</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {songRequests.map((request) => (
                          <div
                            key={request.songId}
                            className={`border rounded-lg p-4 ${
                              request.status === 'completed' 
                                ? 'bg-green-50 border-green-200' 
                                : request.status === 'performing'
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{request.songTitle}</h4>
                                <p className="text-gray-600 text-sm">by {request.artist}</p>
                                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                  <span className="font-medium text-green-600">${request.totalTipAmount.toFixed(2)}</span>
                                  <span>{request.requestCount} request{request.requestCount > 1 ? 's' : ''}</span>
                                  <span>{new Date(request.firstRequestTime).toLocaleTimeString()}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  request.status === 'completed' 
                                    ? 'bg-green-100 text-green-800' 
                                    : request.status === 'performing'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {request.status === 'completed' ? 'Completed' : 
                                   request.status === 'performing' ? 'Performing' : 'Pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deviceToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative p-8 border w-96 shadow-lg rounded-md bg-white">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
              <p className="text-gray-600 mt-2">
                Are you sure you want to delete the device "{deviceToDelete.nickname || deviceToDelete.uuid}"? This action cannot be undone.
              </p>
            </div>
            <div className="items-center px-4 py-3">
              <button
                onClick={confirmDeleteDevice}
                className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Delete
              </button>
              <button
                onClick={cancelDeleteDevice}
                className="mt-3 px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Song Request Monitor */}
      <SongRequestMonitor
        profileId={userProfile?.id || ''}
        isVisible={showMonitorFullscreen}
        onClose={() => setShowMonitorFullscreen(false)}
      />
    </div>
  )
}

export default Dashboard 