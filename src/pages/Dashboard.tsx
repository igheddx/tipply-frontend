import logger from "../utils/logger";
import { PortalShell, type PortalNavItem } from '../components/portal/PortalShell'
import { HomeTab, type HomeData } from '../components/portal/HomeTab'
import { DemoBanner } from '../components/portal/DemoBanner'
import { renderQrCard } from '../utils/qrCard'
import { TipsTimeline } from '../components/charts/TipsTimeline'
import { Banner, Button, Card, EmptyState, Modal, PageHeader, PageLoader, StatusChip, useFeedback, type ChipKind } from '../components/ui'
import { BrandIcon, IconTile } from '../components/icons/BrandIcons'
import { Switch } from '../components/ui/Switch'
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import SongManagement from '../components/SongManagement'
import SongRequestMonitor from '../components/SongRequestMonitor'
import { API_BASE_URL } from '../utils/config'
import { setDemoModeOn, setShowDemoData, demoQuery } from '../utils/demoView'
import { DEFAULT_TIP_AMOUNTS, TIP_AMOUNT_COUNT, LIGHT_EFFECTS, SOUND_OPTIONS, VOLUME_OPTIONS, DEFAULT_SOUND_ID, DEFAULT_SOUND_VOLUME, DEFAULT_EFFECT_CONFIG, normalizeEffectConfig, effectForAmount, buildEffectConfig } from '../utils/deviceConfig'
import TipAmountsEditor from '../components/TipAmountsEditor'

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
  failedTips?: number
  failedTipsCount?: number
  lastMonthTips: number
  trendPercentage: number
  trendDirection: string
  stripeAvailableBalance: number
  stripeFuturePayouts: number
  stripeInTransit: number
  stripeLifetimeVolume: number
  uniqueTippersAllTime: number
  mostTippedDenomination: number
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
  soundId?: number
  soundVolume?: string
  isPaused?: boolean
  effectConfiguration?: string
}

interface TipSummary {
  id: string
  amount: number
  deviceId?: string
  deviceNickname?: string
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

interface WeeklyTipsSummary {
  weekStart: string
  totalAmount: number
  tipsCount: number
  uniqueTippers: number
  averageAmount: number
  maxAmount: number
}

interface HourlyTipsSummary {
  hour: number
  totalAmount: number
  tipsCount: number
  uniqueTippers: number
  averageAmount: number
  maxAmount: number
  denominationTotals: Record<string, number>
}

interface PerformerInsights {
  metrics: DashboardMetrics
  weeklyTips: WeeklyTipsSummary[]
  hourlyTips: HourlyTipsSummary[]
  timezoneLabel: string
  totalBalance: number
  futurePayouts: number
  inTransit: number
  uniqueTippersAllTime: number
  mostTippedDenomination: number
}

interface TipPoint {
  time: string
  amount: number
  timestamp: number
}

const INPUT = 'h-12 w-full rounded-xl border bg-white px-4 text-ink-900 placeholder:text-ink-400 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500'

const Dashboard: React.FC = () => {
  const { toast } = useFeedback()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentTips, setRecentTips] = useState<TipSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [failedTips, setFailedTips] = useState<{ id: string; amount: number; deviceId: string; createdAt: string }[]>([])
  const [activeTab, setActiveTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    return t && ['devices', 'tips', 'songs', 'monitor'].includes(t) ? t : 'overview'
  })
  const [showStripeAlert, setShowStripeAlert] = useState(false)
  const [stripeEnabledDevices, setStripeEnabledDevices] = useState<string[]>([])
  const [userProfile, setUserProfile] = useState<any>(null)
  const [tipAmountsSaving, setTipAmountsSaving] = useState(false)
  // The performer's own tip amounts (defaults until they change them)
  const tipAmounts: number[] = Array.isArray(userProfile?.tipAmounts) && userProfile.tipAmounts.length === TIP_AMOUNT_COUNT
    ? userProfile.tipAmounts
    : DEFAULT_TIP_AMOUNTS
  const [stripeMetricsLoading, setStripeMetricsLoading] = useState(true)
  const [insights, setInsights] = useState<PerformerInsights | null>(null)
  // Production only: the site is taking fake money, and whether the performer is looking at that demo data
  const [demoMode, setDemoMode] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [tipTimelinePoints, setTipTimelinePoints] = useState<TipPoint[]>([])
  // True until the charts' data (weekly totals and every tip) has arrived
  const [chartsLoading, setChartsLoading] = useState(true)
  
  const getDeviceSetupUrl = () => {
    const host = window.location.hostname.toLowerCase()
    if (host.includes('apptest')) {
      return 'https://apptest.tipwave.live/device-setup'
    }
    return 'https://app.tipwave.live/device-setup'
  }
  
  // Add Device Form States
  const [, setShowAddDeviceForm] = useState(false)
  const [addDeviceForm, setAddDeviceForm] = useState({
    serialNumber: '', // Changed from deviceUuid to serialNumber
    nickname: '',
    isAllowSongRequest: false as boolean | null
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
  const [pausingDeviceId, setPausingDeviceId] = useState<string | null>(null)
  
  // Device Configuration States
  const [expandedDeviceConfig, setExpandedDeviceConfig] = useState<string | null>(null)
  const [updatingDeviceConfig, setUpdatingDeviceConfig] = useState<string | null>(null)
  
  // Song Request Monitoring States
  const [showMonitorFullscreen, setShowMonitorFullscreen] = useState(false)
  const [songRequests, setSongRequests] = useState<any[]>([])
  
  // Song Catalog Alert States
  const [, setShowSongCatalogAlert] = useState(false)
  const [songCatalogCount, setSongCatalogCount] = useState(0)
  const [downloadingDeviceId, setDownloadingDeviceId] = useState<string | null>(null)
  
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

        // Is production in demo mode (fake money)? Fails quietly: no banner if we cannot tell.
        void apiService.getDemoMode().then(resp => {
          const on = resp.data?.demoMode === true
          setDemoModeOn(on)
          setDemoMode(on)
        })

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
              const catalogResp = await fetch(`${API_BASE_URL}/api/songcatalog/my-songs/${profileId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
              })
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

        // Background fetch: load Stripe balances and merge them in when ready. This is slow, so the charts below do not wait for it.
        void (async () => {
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
                uniqueTippersAllTime: fullMetrics.data.uniqueTippersAllTime ?? prev.uniqueTippersAllTime,
                mostTippedDenomination: fullMetrics.data.mostTippedDenomination ?? prev.mostTippedDenomination,
              } : fullMetrics.data)
              logger.log(`⏱️ [PERF] Background Stripe metrics loaded in ${(performance.now() - stripeStart).toFixed(0)}ms`)
            }
          } catch (e) {
            logger.warn('Skipping Stripe metrics due to error:', e)
          } finally {
            setStripeMetricsLoading(false)
          }
        })()

        // Background fetch: load insights data for charts
        try {
          const insightsStart = performance.now()
          const timezoneOffset = new Date().getTimezoneOffset()
          const response = await fetch(
            `${API_BASE_URL}/api/tips/insights/${profileId}?timezoneOffsetMinutes=${timezoneOffset}${demoQuery('&')}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (response.ok) {
            const data = await response.json()
            setInsights(data)
            logger.log(`⏱️ [PERF] Insights data loaded in ${(performance.now() - insightsStart).toFixed(0)}ms`)
          }

          const timelineResp = await fetch(
            `${API_BASE_URL}/api/tips/tips-timeline/${profileId}?limit=2000${demoQuery('&')}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (timelineResp.ok) {
            const timelineData = await timelineResp.json()
            const points: TipPoint[] = timelineData.map((tip: any) => {
              const timestamp = new Date(tip.createdAt).getTime()
              return {
                time: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                amount: tip.amount,
                timestamp
              }
            })
            points.sort((a, b) => a.timestamp - b.timestamp)
            setTipTimelinePoints(points)
          }
        } catch (e) {
          logger.warn('Skipping insights data due to error:', e)
        } finally {
          setChartsLoading(false)
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
          void apiService.getFailedTips().then(resp => {
            if (resp.data) setFailedTips(resp.data)
          })
          // Lazy-load tips if not already loaded
          if (recentTips.length === 0) {
            const tipsResp = await apiService.getRecentTips(profileId)
            if (tipsResp.data) {
              setRecentTips(tipsResp.data.map((tip: any) => ({
                id: tip.id,
                amount: tip.amount,
                deviceId: tip.deviceId,
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

  // Switch between real tips and demo (fake money) tips, then reload everything that shows tips
  const handleShowDemoChange = async () => {
    const next = !showDemo
    setShowDemoData(next)
    setShowDemo(next)
    setRecentTips([])
    setFailedTips([])
    await refreshDashboard()
    const failed = await apiService.getFailedTips()
    if (failed.data) setFailedTips(failed.data)
  }

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

      const token = localStorage.getItem('token')
      const timezoneOffset = new Date().getTimezoneOffset()

      // Parallelize all refreshes at once
      const [statsResp, metricsResp, tipsResp, deletedResp, devicesResp, insightsResp, timelineResp] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.getDashboardMetrics(profileId),
        apiService.getRecentTips(profileId),
        apiService.getDeletedDevices(),
        apiService.getDevices(),
        fetch(`${API_BASE_URL}/api/tips/insights/${profileId}?timezoneOffsetMinutes=${timezoneOffset}${demoQuery('&')}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        fetch(`${API_BASE_URL}/api/tips/tips-timeline/${profileId}?limit=2000${demoQuery('&')}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
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
          deviceId: tip.deviceId,
          createdAt: tip.createdAt,
          status: tip.status
        })))
      }

      if (deletedResp.data) {
        setDeletedDevices(deletedResp.data)
      }

      if (insightsResp.ok) {
        const insightsData = await insightsResp.json()
        setInsights(insightsData)
      }

      if (timelineResp.ok) {
        const timelineData = await timelineResp.json()
        const points: TipPoint[] = timelineData.map((tip: any) => {
          const timestamp = new Date(tip.createdAt).getTime()
          return {
            time: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            amount: tip.amount,
            timestamp
          }
        })
        points.sort((a, b) => a.timestamp - b.timestamp)
        setTipTimelinePoints(points)
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
    setAddDeviceForm({ serialNumber: '', nickname: '', isAllowSongRequest: false })
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
      setAddDeviceForm({ serialNumber: '', nickname: '', isAllowSongRequest: false })
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
    setDownloadingDeviceId(deviceId)
    try {
      console.info('[QR] Download clicked', { deviceId, nickname })

      // Always fetch QR as a blob from API to avoid cross-origin issues
      const qrBlob = await apiService.downloadQRCode(deviceId)
      if (!qrBlob) {
        toast('Could not download QR code. Please try again or check your connection.', 'error')
        setDownloadingDeviceId(null)
        return
      }

      if (!qrBlob.type.startsWith('image/')) {
        toast(`QR download returned a non-image content-type: ${qrBlob.type || 'unknown'}`, 'error')
        setDownloadingDeviceId(null)
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
        toast('Could not generate the branded card because the QR image could not be decoded. Downloaded the raw QR instead.', 'info')
        setDownloadingDeviceId(null)
        return
      }

      // Get stage name from profile
      const stageName = userProfile?.stageName || userProfile?.firstName || 'Performer'

      let canvas: HTMLCanvasElement
      try {
        canvas = await renderQrCard(qrBitmap, stageName)
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
        toast('Could not render the branded card. Downloaded the raw QR instead.', 'info')
        setDownloadingDeviceId(null)
        return
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
          setDownloadingDeviceId(null)
        } else {
          toast('Failed to create download file', 'error')
          setDownloadingDeviceId(null)
        }
      }, 'image/png')
    } catch (error) {
      logger.error('Error generating QR card:', error)
      toast(`Could not generate the QR card. ${error instanceof Error ? error.message : 'Please try again.'}`, 'error')
      setDownloadingDeviceId(null)
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
        toast('Failed to delete device: ' + (response.error || 'Unknown error'), 'error')
      }
    } catch (error) {
      logger.error('Error deleting device:', error)
      toast('Error deleting device', 'error')
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
        toast('Failed to restore device: ' + (response.error || 'Unknown error'), 'error')
      }
    } catch (error) {
      logger.error('Error restoring device:', error)
      toast('Error restoring device', 'error')
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
        toast('Failed to update song request setting: ' + (response.error || 'Unknown error'), 'error')
      }
    } catch (error) {
      logger.error('Error updating song request setting:', error)
      toast('Error updating song request setting', 'error')
    } finally {
      setUpdatingSongRequest(null)
    }
  }

  const toggleDevicePause = async (deviceId: string) => {
    const device = stats?.devices.find(d => d.id === deviceId)
    if (!device) return
    const newPaused = !device.isPaused
    setPausingDeviceId(deviceId)
    try {
      const response = await apiService.updateDevicePause(deviceId, newPaused)
      if (response.data?.success) {
        setStats(prevStats => prevStats && {
          ...prevStats,
          devices: prevStats.devices.map(d => (d.id === deviceId ? { ...d, isPaused: newPaused } : d))
        })
      } else {
        toast('Failed to update device: ' + (response.error || 'Unknown error'), 'error')
      }
    } catch (error) {
      logger.error('Error updating device pause state:', error)
      toast('Error updating device pause state', 'error')
    } finally {
      setPausingDeviceId(null)
    }
  }

  const updateDeviceConfiguration = async (
    deviceId: string,
    isSoundEnabled: boolean,
    isRandomLightEffect: boolean,
    effectConfig: Record<string, string>,
    soundId: number = DEFAULT_SOUND_ID,
    soundVolume: string = DEFAULT_SOUND_VOLUME
  ) => {
    setUpdatingDeviceConfig(deviceId)
    try {
      logger.log('📤 Sending device configuration update:', { deviceId, isSoundEnabled, isRandomLightEffect, effectConfig })
      const response = await apiService.updateDeviceConfiguration(deviceId, {
        isSoundEnabled,
        isRandomLightEffect,
        soundId,
        soundVolume,
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
              return { ...d, isSoundEnabled, isRandomLightEffect, soundId, soundVolume, effectConfiguration: JSON.stringify(effectConfig) }
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
        toast('Failed to update device configuration: ' + (response.error || 'Unknown error'), 'error')
      }
    } catch (error) {
      logger.error('❌ Error updating device configuration:', error)
      logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
      toast('Error updating device configuration: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
    } finally {
      setUpdatingDeviceConfig(null)
    }
  }

  // Saves one changed setting while keeping the device's other current settings
  const saveDeviceConfig = (
    device: DeviceSummary,
    patch: { isSoundEnabled?: boolean; isRandomLightEffect?: boolean; effectConfig?: Record<string, string>; soundId?: number; soundVolume?: string }
  ) => updateDeviceConfiguration(
    device.id,
    patch.isSoundEnabled ?? device.isSoundEnabled ?? false,
    patch.isRandomLightEffect ?? device.isRandomLightEffect ?? false,
    buildEffectConfig(patch.effectConfig ?? getEffectConfig(device), tipAmounts),
    patch.soundId ?? device.soundId ?? DEFAULT_SOUND_ID,
    patch.soundVolume ?? device.soundVolume ?? DEFAULT_SOUND_VOLUME
  )

  const saveTipAmounts = async (amounts: number[]) => {
    setTipAmountsSaving(true)
    try {
      const response = await apiService.put('/api/profiles/me/tip-amounts', { amounts })
      if (response.data?.amounts) {
        setUserProfile((prev: any) => ({ ...prev, tipAmounts: response.data.amounts }))
      } else {
        toast('Failed to save tip amounts: ' + (response.error || 'Unknown error'), 'error')
      }
    } finally {
      setTipAmountsSaving(false)
    }
  }

  const resetTipAmounts = async () => {
    setTipAmountsSaving(true)
    try {
      const response = await apiService.delete('/api/profiles/me/tip-amounts')
      if (response.data?.amounts) {
        setUserProfile((prev: any) => ({ ...prev, tipAmounts: response.data.amounts }))
      } else {
        toast('Failed to reset tip amounts: ' + (response.error || 'Unknown error'), 'error')
      }
    } finally {
      setTipAmountsSaving(false)
    }
  }

  const getEffectConfig = (device: DeviceSummary): Record<string, string> => {
    try {
      if (device.effectConfiguration) {
        return normalizeEffectConfig(JSON.parse(device.effectConfiguration))
      }
    } catch (e) {
      logger.error('❌ Error parsing effect configuration:', e, 'Raw value:', device.effectConfiguration)
    }
    return { ...DEFAULT_EFFECT_CONFIG }
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
      <PageLoader label="Loading your portal…" />
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-500">Failed to load dashboard data</p>
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

  const hasSongRequestEnabled = stats?.devices?.some(device => device.isAllowSongRequest) ?? false

  const displayName = userProfile?.stageName || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 'Performer'

  const navItems: PortalNavItem[] = [
    { id: 'overview', label: 'Home', icon: 'home' },
    { id: 'devices', label: 'Devices', icon: 'device' },
    { id: 'tips', label: 'Tips', icon: 'coin' },
    { id: 'songs', label: 'Songs', icon: 'music' },
    ...(hasSongRequestEnabled ? [{ id: 'monitor', label: 'Live', icon: 'mic' } as PortalNavItem] : []),
    ...(userProfile?.role === 'root_admin' ? [{ id: 'admin', label: 'Admin', icon: 'shield' } as PortalNavItem] : [])
  ]

  const handleNavSelect = (id: string) => {
    if (id === 'admin') {
      navigate('/admin')
      return
    }
    setShowAddDeviceForm(false)
    setActiveTab(id)
    window.scrollTo({ top: 0 })
  }

  const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
    devices: { title: 'Devices', subtitle: 'Your Tipwave devices, tip amounts and QR codes.' },
    tips: { title: 'Tips', subtitle: 'Your latest tips and whether they have been charged.' },
    songs: { title: 'Song catalog', subtitle: 'The songs your audience can pick from.' },
    monitor: { title: 'Live requests', subtitle: 'Song requests as they come in.' }
  }

  const deviceList = stats.devices ?? []
  const weekRows = (insights?.weeklyTips ?? []).slice(-8).map(w => {
    const d = new Date(w.weekStart)
    return { week: `${d.getMonth() + 1}/${d.getDate()}`, total: w.totalAmount }
  })
  const homeData: HomeData = {
    firstName: userProfile?.firstName || userProfile?.stageName || '',
    today: { amount: metrics ? metrics.todaysTips : stats.todayTipsReceived, count: stats.todayTipsCount },
    month: {
      amount: metrics ? metrics.thisMonthTips : stats.thisMonthTipsReceived,
      count: stats.thisMonthTipsCount,
      trendPercent: metrics?.trendPercentage ?? 0,
      trendDirection: metrics?.trendDirection ?? 'up'
    },
    pendingTips: metrics?.pendingTips ?? 0,
    failedTips: metrics?.failedTips ?? 0,
    failedTipsCount: metrics?.failedTipsCount ?? 0,
    scheduledPayouts: metrics?.stripeFuturePayouts ?? 0,
    inTransit: metrics?.stripeInTransit ?? 0,
    available: metrics?.stripeAvailableBalance ?? 0,
    lifetime: metrics?.stripeLifetimeVolume ?? 0,
    balancesLoading: stripeMetricsLoading,
    devices: {
      total: deviceList.length,
      paused: deviceList.filter(d => d.isPaused).length,
      active: deviceList.filter(d => d.isOnline && !d.isPaused).length,
      offline: deviceList.filter(d => !d.isOnline && !d.isPaused).length
    },
    weeks: weekRows,
    weeksLoading: chartsLoading,
    nextSteps: [
      {
        id: 'device',
        icon: 'device',
        title: 'Add your first device',
        detail: 'Register the Tipwave device you will perform with.',
        done: stats.totalDevices > 0,
        actionLabel: 'Add device',
        onAction: handleAddDeviceClick
      },
      {
        id: 'payouts',
        icon: 'bank',
        title: 'Set up payouts',
        detail: 'Verify your identity with Stripe so tips can reach your bank.',
        done: !!userProfile?.stripeAccountId,
        actionLabel: 'Set up',
        onAction: () => navigate('/profile')
      },
      ...(hasSongRequestEnabled
        ? [
            {
              id: 'songs',
              icon: 'music' as const,
              title: 'Add songs to your catalog',
              detail: 'Fans can only request songs that are in your catalog.',
              done: songCatalogCount > 0,
              actionLabel: 'Add songs',
              onAction: () => setActiveTab('songs')
            }
          ]
        : []),
      {
        id: 'photo',
        icon: 'user',
        title: 'Add a profile photo',
        detail: 'It appears at the top of your tipping page.',
        done: !!userProfile?.profilePhotoUrl,
        actionLabel: 'Add photo',
        onAction: () => navigate('/profile')
      }
    ]
  }

  return (
    <div className="min-h-screen bg-surface text-ink-900">
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
                  Stripe account verified
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



      <PortalShell
        items={navItems}
        active={activeTab === 'addDevice' ? 'devices' : activeTab}
        onSelect={handleNavSelect}
        userName={displayName}
        userPhotoUrl={userProfile?.profilePhotoUrl || undefined}
        onOpenProfile={() => navigate('/profile')}
        onLogout={handleLogout}
      >
        <DemoBanner demoMode={demoMode} showDemo={showDemo} onToggle={handleShowDemoChange} />
        {activeTab !== 'overview' && activeTab !== 'addDevice' && (
          <PageHeader title={PAGE_TITLES[activeTab]?.title || ''} subtitle={PAGE_TITLES[activeTab]?.subtitle} />
        )}
        <div>
            {activeTab === 'overview' && (
              <HomeTab
                data={homeData}
                formatCurrency={formatCurrency}
                onGoToDevices={() => (stats.totalDevices === 0 ? handleAddDeviceClick() : setActiveTab('devices'))}
                onGoToTips={() => setActiveTab('tips')}
                onGoToLive={hasSongRequestEnabled ? () => setActiveTab('monitor') : undefined}
              />
            )}

            {activeTab === 'devices' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button icon="plus" onClick={handleAddDeviceClick}>
                    Add device
                  </Button>
                  <Button variant="secondary" icon="wifi" onClick={() => window.open(getDeviceSetupUrl(), '_blank')}>
                    Connect a device to Wi-Fi
                  </Button>
                  <Button variant="ghost" icon="refresh" onClick={refreshDashboard} aria-label="Refresh device status" title="Refresh device status" />
                </div>

                {stats.devices.length === 0 && (
                  <Card>
                    <EmptyState
                      icon="device"
                      title="No devices yet"
                      action={<Button onClick={handleAddDeviceClick}>Add your first device</Button>}
                    >
                      Add the Tipwave device you perform with. You will get a QR code for your audience.
                    </EmptyState>
                  </Card>
                )}

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {stats.devices.map(device => {
                    const chip: ChipKind = device.isPaused ? 'paused' : device.isOnline ? 'active' : 'offline'
                    const busyConfig = updatingDeviceConfig === device.id
                    return (
                      <Card key={device.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-bold text-ink-900">{device.nickname || 'Unnamed device'}</h3>
                            <p className="mt-0.5 truncate text-xs text-ink-400">ID {device.uuid}</p>
                          </div>
                          <StatusChip kind={chip} />
                        </div>

                        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-surface p-3 text-center">
                          <div>
                            <dt className="text-xs text-ink-500">Tips</dt>
                            <dd className="text-base font-bold text-ink-900">{device.totalTipsCount}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-ink-500">Earned</dt>
                            <dd className="text-base font-bold text-ink-900">{formatCurrency(device.totalTipsReceived)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-ink-500">Last tip</dt>
                            <dd className="text-sm font-semibold text-ink-900">
                              {device.totalTipsCount > 0 ? formatDate(device.lastTipReceived) : 'No tips yet'}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            icon="download"
                            loading={downloadingDeviceId === device.id}
                            onClick={() => downloadQRCode(device.id, device.nickname)}
                          >
                            Download QR code
                          </Button>
                          <Button variant="secondary" icon="qr" onClick={() => window.open(device.qrCodeUrl, '_blank')}>
                            Open tip page
                          </Button>
                          <Button
                            variant="secondary"
                            icon={device.isPaused ? 'play' : 'pause'}
                            loading={pausingDeviceId === device.id}
                            onClick={() => toggleDevicePause(device.id)}
                            title={
                              device.isPaused
                                ? 'Turn the light and sound back on'
                                : 'Stops light and sound. Tips still go through.'
                            }
                          >
                            {device.isPaused ? 'Resume' : 'Pause'}
                          </Button>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                          <div>
                            <div className="text-sm font-semibold text-ink-900">Song requests</div>
                            <div className="text-xs text-ink-500">Let people pick a song when they tip.</div>
                          </div>
                          <Switch
                            checked={device.isAllowSongRequest}
                            disabled={updatingSongRequest === device.id}
                            label="Song requests"
                            onChange={() => toggleSongRequestSetting(device)}
                          />
                        </div>

                        <button
                          onClick={() => setExpandedDeviceConfig(expandedDeviceConfig === device.id ? null : device.id)}
                          aria-expanded={expandedDeviceConfig === device.id}
                          className="mt-4 flex w-full items-center justify-between border-t border-slate-100 pt-4 text-left"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-ink-900">Sound and lights</span>
                            <span className="block text-xs text-ink-500">Volume, tones and light effects for each tip amount</span>
                          </span>
                          <BrandIcon name={expandedDeviceConfig === device.id ? 'chevron-down' : 'chevron-right'} size={18} tone="muted" />
                        </button>

                        {expandedDeviceConfig === device.id && (
                          <div className="mt-3 space-y-4 rounded-xl bg-surface p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-ink-700">Sound</span>
                              <Switch
                                checked={device.isSoundEnabled ?? false}
                                disabled={busyConfig}
                                label="Sound"
                                onChange={() => saveDeviceConfig(device, { isSoundEnabled: !(device.isSoundEnabled ?? false) })}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-ink-700">Tone</span>
                              <select
                                value={device.soundId ?? DEFAULT_SOUND_ID}
                                onChange={e => saveDeviceConfig(device, { soundId: Number(e.target.value) })}
                                disabled={busyConfig || !(device.isSoundEnabled ?? false)}
                                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100 disabled:text-ink-400"
                              >
                                {SOUND_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-ink-700">Volume</span>
                              <select
                                value={device.soundVolume ?? DEFAULT_SOUND_VOLUME}
                                onChange={e => saveDeviceConfig(device, { soundVolume: e.target.value })}
                                disabled={busyConfig || !(device.isSoundEnabled ?? false)}
                                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100 disabled:text-ink-400"
                              >
                                {VOLUME_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-ink-700">Random light effect</span>
                              <Switch
                                checked={device.isRandomLightEffect ?? false}
                                disabled={busyConfig}
                                label="Random light effect"
                                onChange={() => saveDeviceConfig(device, { isRandomLightEffect: !(device.isRandomLightEffect ?? false) })}
                              />
                            </div>
                            <div className="border-t border-slate-200 pt-3">
                              <div className="mb-2 text-sm font-semibold text-ink-900">Light effect for each tip amount</div>
                              <div className="space-y-2">
                                {(() => {
                                  const effectConfig = getEffectConfig(device)
                                  return tipAmounts.map(amount => (
                                    <div key={amount} className="flex items-center justify-between text-sm">
                                      <span className="font-medium text-ink-700">${amount}</span>
                                      <select
                                        value={effectForAmount(effectConfig, amount)}
                                        onChange={e =>
                                          saveDeviceConfig(device, { effectConfig: { ...effectConfig, [amount.toString()]: e.target.value } })
                                        }
                                        disabled={busyConfig}
                                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                                      >
                                        {LIGHT_EFFECTS.map(effect => (
                                          <option key={effect.value} value={effect.value}>
                                            {effect.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ))
                                })()}
                              </div>
                            </div>
                            {busyConfig && <div className="text-center text-xs text-brand-700">Saving…</div>}
                          </div>
                        )}

                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <Button
                            variant="danger"
                            size="sm"
                            icon="trash"
                            loading={isDeletingDevice === device.id}
                            onClick={() => handleSoftDeleteDevice(device)}
                          >
                            Remove device
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>

                <TipAmountsEditor
                  amounts={tipAmounts}
                  saving={tipAmountsSaving}
                  onSave={saveTipAmounts}
                  onReset={resetTipAmounts}
                />

                {/* Removed devices */}
                <div>
                  <button
                    onClick={toggleDeletedDevices}
                    aria-expanded={showDeletedDevices}
                    className="flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700"
                  >
                    <BrandIcon name={showDeletedDevices ? 'chevron-down' : 'chevron-right'} size={16} tone="muted" />
                    {showDeletedDevices ? 'Hide' : 'Show'} removed devices
                  </button>

                  {showDeletedDevices && (
                    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {deletedDevices.length === 0 ? (
                        <p className="text-sm text-ink-500">No removed devices.</p>
                      ) : (
                        deletedDevices.map(device => (
                          <Card key={device.id}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate font-bold text-ink-900">{device.nickname || 'Unnamed device'}</div>
                                <div className="truncate text-xs text-ink-400">ID {device.uuid}</div>
                                {device.deletedAt && (
                                  <div className="mt-1 text-xs text-ink-500">Removed {formatDate(device.deletedAt)}</div>
                                )}
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon="refresh"
                                loading={isRestoringDevice === device.id}
                                onClick={() => handleRestoreDevice(device.id)}
                              >
                                Restore
                              </Button>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'tips' && (
              <Card
                title="Last 24 hours"
                subtitle="Your 10 most recent tips. Waiting tips are charged in the next batch."
                flush
              >
                {recentTips.length === 0 ? (
                  <EmptyState icon="coin" title="No tips in the last 24 hours">
                    New tips show up here the moment someone sends one.
                  </EmptyState>
                ) : (
                  <ul className="divide-y divide-slate-100 px-5 pb-2">
                    {recentTips.map(tip => {
                      const device = (stats.devices ?? []).find(d => d.id === tip.deviceId || d.uuid === tip.deviceId)
                      const kind = tip.status === 'processed' ? 'paid' : tip.status === 'pending' ? 'processing' : 'failed'
                      const label = tip.status === 'processed' ? 'Charged' : tip.status === 'pending' ? 'Waiting' : 'Not charged'
                      return (
                        <li key={tip.id} className="flex items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-bold text-ink-900">{formatCurrency(tip.amount)}</div>
                            <div className="truncate text-xs text-ink-500">
                              {device?.nickname || 'Tipwave device'} · {new Date(tip.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                          <StatusChip kind={kind} label={label} />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            )}

            {activeTab === 'tips' && failedTips.length > 0 && (
              <div className="mt-5">
                <Card
                  title="Not charged"
                  subtitle={`${failedTips.length === 1 ? '1 tip' : `${failedTips.length} tips`} could not be charged. They are not counted in what you are owed.`}
                  flush
                >
                  <ul className="divide-y divide-slate-100 px-5 pb-2">
                    {failedTips.map(tip => {
                      const device = (stats.devices ?? []).find(d => d.id === tip.deviceId || d.uuid === tip.deviceId)
                      return (
                        <li key={tip.id} className="flex items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-bold text-ink-900">{formatCurrency(tip.amount)}</div>
                            <div className="truncate text-xs text-ink-500">
                              {device?.nickname || 'Tipwave device'} · {new Date(tip.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                          <StatusChip kind="failed" label="Not charged" />
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              </div>
            )}

            {activeTab === 'tips' && (
              <div className="mt-5">
                <TipsTimeline points={tipTimelinePoints} loading={chartsLoading} />
              </div>
            )}

            {activeTab === 'addDevice' && (
              <div className="max-w-2xl space-y-5">
                {!showStripeSetup ? (
                  <Card
                    title="Add a device"
                    subtitle="Enter the serial number printed on your Tipwave device."
                  >
                    <form onSubmit={(e) => { e.preventDefault(); handleAddDeviceSubmit(); }} className="space-y-5">
                      <div>
                        <label htmlFor="serialNumber" className="mb-1.5 block text-sm font-semibold text-ink-700">
                          Serial number
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
                            autoCapitalize="characters"
                            autoCorrect="off"
                            spellCheck={false}
                            className={`${INPUT} pr-11 uppercase placeholder:normal-case ${addDeviceErrors.serialNumber ? 'border-red-400' : 'border-slate-300'}`}
                            placeholder="TPY-5C07-K73"
                          />
                          <div className="absolute inset-y-0 right-3 flex items-center">
                            {isValidatingAddDevice && (
                              <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                            )}
                            {!isValidatingAddDevice && addDeviceValidationComplete && !addDeviceErrors.serialNumber && addDeviceForm.serialNumber.trim() && (
                              <BrandIcon name="check-circle" size={22} color="#15803D" />
                            )}
                          </div>
                        </div>
                        {addDeviceErrors.serialNumber ? (
                          <p className="mt-1.5 text-sm text-red-600">{addDeviceErrors.serialNumber}</p>
                        ) : addDeviceValidationComplete && addDeviceForm.serialNumber.trim() ? (
                          <p className="mt-1.5 text-sm text-green-700">Device found</p>
                        ) : (
                          <p className="mt-1.5 text-sm text-ink-500">It looks like TPY-5C07-K73 and is on the back of the device.</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="nickname" className="mb-1.5 block text-sm font-semibold text-ink-700">
                          Nickname
                        </label>
                        <input
                          type="text"
                          id="nickname"
                          value={addDeviceForm.nickname}
                          onChange={(e) => handleAddDeviceInputChange('nickname', e.target.value)}
                          className={`${INPUT} ${addDeviceErrors.nickname ? 'border-red-400' : 'border-slate-300'}`}
                          placeholder="Main stage"
                        />
                        {addDeviceErrors.nickname ? (
                          <p className="mt-1.5 text-sm text-red-600">{addDeviceErrors.nickname}</p>
                        ) : (
                          <p className="mt-1.5 text-sm text-ink-500">Helps you tell devices apart, like Main stage or Bar counter.</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center gap-3">
                          <IconTile name="music" size={40} />
                          <div>
                            <div className="font-semibold text-ink-900">Let people request songs</div>
                            <div className="text-sm text-ink-500">Fans can pick a song when they tip. You can change this any time.</div>
                          </div>
                        </div>
                        <Switch
                          checked={addDeviceForm.isAllowSongRequest === true}
                          label="Let people request songs"
                          onChange={() => setAddDeviceForm(prev => ({ ...prev, isAllowSongRequest: !prev.isAllowSongRequest }))}
                        />
                      </div>

                      {addDeviceErrors.submit && (
                        <Banner tone="error" title="We could not add the device">
                          {addDeviceErrors.submit}
                        </Banner>
                      )}

                      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                        <Button variant="secondary" size="lg" onClick={handleBackToDashboard}>
                          Cancel
                        </Button>
                        <Button type="submit" size="lg" loading={isAddingDevice}>
                          Add device
                        </Button>
                      </div>
                    </form>
                  </Card>
                ) : (
                  <Banner
                    tone="warning"
                    title="Set up payouts first"
                    action={
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={handleStripeConnect} loading={isAddingDevice}>
                          Complete Stripe setup
                        </Button>
                        <Button variant="secondary" onClick={handleBackToDashboard}>
                          Back to Home
                        </Button>
                      </div>
                    }
                  >
                    Before you add another device, finish your Stripe account setup and identity verification.
                    {addDeviceErrors.submit && <span className="mt-2 block font-semibold text-red-700">{addDeviceErrors.submit}</span>}
                  </Banner>
                )}
              </div>
            )}

            {activeTab === 'songs' && (
              <div id="songs-section" className="space-y-6">
                <SongManagement profileId={userProfile?.id} />
              </div>
            )}

            {activeTab === 'monitor' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Button icon="mic" onClick={() => setShowMonitorFullscreen(true)}>
                    Open full-screen view
                  </Button>
                  <Button variant="secondary" icon="qr" onClick={() => window.open('/monitor', '_blank')}>
                    Open in its own window
                  </Button>
                </div>
                <p className="text-sm text-ink-500">
                  On a tablet, open it in its own window to keep it beside your charts or sheet music. Bookmark /monitor or add it to your home screen to jump straight in.
                </p>
                <p className="text-sm text-ink-500">
                  To see both at once on an iPad, swipe up from the bottom for the dock, then drag Safari next to your music app.
                </p>
                <Card title="Today's requests" subtitle="The most-tipped songs come first." flush>
                  {songRequests.length === 0 ? (
                    <EmptyState icon="music" title="No song requests today">
                      When someone tips and picks a song, it shows up here.
                    </EmptyState>
                  ) : (
                    <ul className="divide-y divide-slate-100 px-5 pb-2">
                      {songRequests.map(request => (
                        <li key={request.songId} className="flex items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-bold text-ink-900">{request.songTitle}</div>
                            <div className="truncate text-sm text-ink-500">{request.artist}</div>
                            <div className="mt-0.5 text-xs text-ink-400">
                              {formatCurrency(request.totalTipAmount)} · {request.requestCount} {request.requestCount === 1 ? 'request' : 'requests'} ·{' '}
                              {new Date(request.firstRequestTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                          <StatusChip
                            kind={request.status === 'completed' ? 'paid' : request.status === 'performing' ? 'active' : 'processing'}
                            label={request.status === 'completed' ? 'Played' : request.status === 'performing' ? 'Playing' : 'Waiting'}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            )}
        </div>
      </PortalShell>

      {/* Remove device confirmation */}
      <Modal
        open={showDeleteModal && !!deviceToDelete}
        onClose={cancelDeleteDevice}
        title="Remove this device?"
        footer={
          <>
            <Button variant="secondary" onClick={cancelDeleteDevice}>
              Keep device
            </Button>
            <Button variant="danger" icon="trash" onClick={confirmDeleteDevice}>
              Remove device
            </Button>
          </>
        }
      >
        <p className="text-ink-700">
          <strong>{deviceToDelete?.nickname || deviceToDelete?.uuid}</strong> will stop taking tips. You can restore it later from Devices, under removed devices.
        </p>
      </Modal>

      {/* Full-Screen Song Request Monitor */}
      <SongRequestMonitor
        profileId={userProfile?.id || ''}
        isVisible={showMonitorFullscreen}
        onClose={() => setShowMonitorFullscreen(false)}
        devices={(stats?.devices ?? []).filter(d => d.isAllowSongRequest)}
        pausingDeviceId={pausingDeviceId}
        onTogglePause={toggleDevicePause}
      />
    </div>
  )
}

export default Dashboard 