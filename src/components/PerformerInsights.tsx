import React, { useState, useEffect, useRef, useCallback } from 'react'
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AutoComplete } from 'antd'
import type { BaseOptionType } from 'antd/es/select'
import logger from '../utils/logger'
import { API_BASE_URL } from '../utils/config'
import { apiService } from '../services/api'

interface PerformerDevice {
  id: string
  serialNumber?: string
  nickname?: string
  isDeleted: boolean
  createdAt: string
  isSoundEnabled?: boolean
  isRandomLightEffect?: boolean
  effectConfiguration?: string
}

interface PerformerSearchResult {
  id: string
  firstName: string
  lastName: string
  email: string
  stageName?: string
  isActive: boolean
  devices: PerformerDevice[]
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

interface DashboardMetricsResponse {
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

interface PerformerInsights {
  metrics: DashboardMetricsResponse
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

const PerformerInsights: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchOptions, setSearchOptions] = useState<BaseOptionType[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPerformer, setSelectedPerformer] = useState<PerformerSearchResult | null>(null)
  const [insights, setInsights] = useState<PerformerInsights | null>(null)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<PerformerDevice | null>(null)
  const [allPerformers, setAllPerformers] = useState<PerformerSearchResult[]>([])
  const [isDownloadingQR, setIsDownloadingQR] = useState(false)
  const [tipTimelinePoints, setTipTimelinePoints] = useState<TipPoint[]>([])
  
  // Time window filter for hourly chart
  const [startDateTime, setStartDateTime] = useState('')
  const [endDateTime, setEndDateTime] = useState('')
  const [filteredTipPoints, setFilteredTipPoints] = useState<TipPoint[]>([])

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const performSearch = useCallback(async (term: string) => {
    if (!term || term.trim().length < 2) {
      setSearchOptions([])
      return
    }

    setIsSearching(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_BASE_URL}/api/admin/performers/search-devices?q=${encodeURIComponent(term)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data: PerformerSearchResult[] = await response.json()
        setAllPerformers(data)
        
        const options = data.map(performer => ({
          value: performer.id,
          label: (
            <div className="py-1">
              <div className="font-medium text-gray-900">
                {performer.firstName} {performer.lastName}
                {performer.stageName && <span className="text-purple-600 ml-2">({performer.stageName})</span>}
              </div>
              <div className="text-sm text-gray-500">{performer.email}</div>
            </div>
          ),
          searchText: `${performer.firstName} ${performer.lastName} ${performer.stageName || ''} ${performer.email}`.toLowerCase()
        }))
        
        setSearchOptions(options)
      } else {
        logger.error('Failed to search performers')
        setSearchOptions([])
      }
    } catch (error) {
      logger.error('Error searching performers:', error)
      setSearchOptions([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value)
    }, 300) // 300ms debounce
  }

  const handleSelect = (value: string) => {
    const performer = allPerformers.find(p => p.id === value)
    if (performer) {
      console.log('Selected performer:', performer)
      console.log('Devices:', performer.devices)
      setSelectedPerformer(performer)
      setStartDateTime('')
      setEndDateTime('')
      setFilteredTipPoints([])
      setTipTimelinePoints([])
      loadPerformerInsights(performer.id)
    }
  }

  const loadPerformerInsights = async (performerId: string) => {
    setIsLoadingInsights(true)
    try {
      const token = localStorage.getItem('token')
      const timezoneOffset = new Date().getTimezoneOffset()
      const response = await fetch(
        `${API_BASE_URL}/api/admin/performers/${performerId}/insights?timezoneOffsetMinutes=${timezoneOffset}`,
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
      } else {
        logger.error('Failed to load insights')
      }

      const timelineResp = await fetch(
        `${API_BASE_URL}/api/admin/performers/${performerId}/tips-timeline?limit=2000`,
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
    } catch (error) {
      logger.error('Error loading insights:', error)
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const handleBack = () => {
    setSelectedPerformer(null)
    setInsights(null)
    setSearchTerm('')
    setSearchOptions([])
  }

  const downloadQRCode = async (deviceId: string, nickname: string) => {
    setIsDownloadingQR(true)
    try {
      console.info('[QR] Download clicked', { deviceId, nickname })
      console.info('[QR] API URL:', `${API_BASE_URL}/api/admin/devices/${deviceId}/qr`)

      const token = localStorage.getItem('token')
      if (!token) {
        console.error('[QR] No token found')
        alert('Authentication token not found. Please log in again.')
        setIsDownloadingQR(false)
        return
      }

      console.info('[QR] Fetching QR code from backend...')
      const response = await fetch(`${API_BASE_URL}/api/admin/devices/${deviceId}/qr`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-cache'
      })

      console.info('[QR] Response received:', { status: response.status, statusText: response.statusText, contentType: response.headers.get('content-type') })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[QR] Error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
      }

      console.info('[QR] Converting response to blob...')
      const qrBlob = await response.blob()
      console.info('[QR] Blob received:', { size: qrBlob.size, type: qrBlob.type })
      
      if (!qrBlob) {
        console.error('[QR] Blob is null or undefined')
        alert('Could not download QR code. Please try again or check your connection.')
        setIsDownloadingQR(false)
        return
      }

      if (!qrBlob.type.startsWith('image/')) {
        alert(`QR download returned a non-image content-type: ${qrBlob.type || 'unknown'}`)
        setIsDownloadingQR(false)
        return
      }

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
            console.info('[QR] Detected base64 PNG response; converted to binary')
          }
        } catch (decodeErr) {
          logger.warn('[QR] Base64 normalization failed; using original blob', decodeErr)
        }
      }

      const qrBlobUrl = URL.createObjectURL(sourceBlob)
      let qrBitmap: ImageBitmap
      try {
        console.log('[QR] Creating bitmap from blob...')
        qrBitmap = await createImageBitmap(sourceBlob)
        console.log('[QR] Bitmap created successfully:', { width: qrBitmap.width, height: qrBitmap.height })
      } catch (err) {
        logger.error('[QR] Bitmap decode failed', err)
        const rawUrl = URL.createObjectURL(sourceBlob)
        const a = document.createElement('a')
        a.href = rawUrl
        a.download = `tipwave-qr-${nickname || deviceId}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(rawUrl)
        alert('Could not generate the branded card. Downloaded the raw QR instead.')
        setIsDownloadingQR(false)
        return
      }

      const stageName = selectedPerformer?.stageName || `${selectedPerformer?.firstName || ''} ${selectedPerformer?.lastName || ''}`.trim() || 'Performer'
      console.log('[QR] Stage name:', stageName)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.error('[QR] Failed to get canvas context')
        setIsDownloadingQR(false)
        return
      }
      console.log('[QR] Canvas created successfully')

      const width = 1200
      const height = 1800
      canvas.width = width
      canvas.height = height

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)

      const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(img)
        img.src = src
      })

      const [logo, musicNote] = await Promise.all([
        loadImage('/images/logo/tipwave-logo2b.png?v=20260208'),
        loadImage('/images/icons8-music-note-90.png')
      ])
      console.log('[QR] Images loaded. Logo:', { complete: logo.complete, height: logo.naturalHeight }, 'MusicNote:', { complete: musicNote.complete, height: musicNote.naturalHeight })

      const headerBarHeight = 260
      ctx.fillStyle = '#111111'
      ctx.fillRect(0, 0, width, headerBarHeight)
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 118px Arial, sans-serif'
      ctx.textAlign = 'center'
      const headerTextY = 165
      const headerText = 'TIP THE PERFORMER'
      const iconSize = musicNote.complete && musicNote.naturalHeight > 0 ? 200 : 0
      const iconGap = iconSize ? 14 : 0
      const headerTextWidth = ctx.measureText(headerText).width
      const headerTotalWidth = headerTextWidth + iconSize + iconGap
      const headerSidePadding = 70
      const headerMaxWidth = width - (headerSidePadding * 2)
      const headerScaleX = headerTotalWidth > headerMaxWidth ? headerMaxWidth / headerTotalWidth : 1

      ctx.save()
      ctx.translate(width / 2, 0)
      ctx.scale(headerScaleX, 1)
      const headerStartX = -(headerTotalWidth / 2)
      const iconY = (headerBarHeight - iconSize) / 2
      if (iconSize) {
        ctx.drawImage(musicNote, headerStartX, iconY, iconSize, iconSize)
      }
      ctx.fillText(headerText, headerStartX + iconSize + iconGap + headerTextWidth / 2, headerTextY)
      ctx.restore()

      try {
        if (!qrBitmap.width || !qrBitmap.height) {
          throw new Error('QR image is empty or failed to load')
        }
        const qrSize = 900
        const borderSize = 42
        const qrX = (width - qrSize) / 2
        const qrY = 360
        ctx.fillStyle = '#111111'
        ctx.fillRect(qrX - borderSize, qrY - borderSize, qrSize + borderSize * 2, qrSize + borderSize * 2)
        ctx.drawImage(qrBitmap, qrX, qrY, qrSize, qrSize)
      } catch (err) {
        logger.error('[QR] Draw failed', err)
        const rawUrl = URL.createObjectURL(qrBlob)
        const a = document.createElement('a')
        a.href = rawUrl
        a.download = `tipwave-qr-${nickname || deviceId}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(rawUrl)
        alert('Could not render the branded card. Downloaded the raw QR instead.')
        setIsDownloadingQR(false)
        return
      }

      ctx.fillStyle = '#374151'
      ctx.font = '24px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Scan to tip instantly', width / 2, 1340)

      ctx.fillStyle = '#111827'
      ctx.font = '26px Arial, sans-serif'
      ctx.fillText('Scan. Choose how to pay. Tap to tip.', width / 2, 1372)

      const trustText = 'Secure payments powered by Stripe'
      ctx.font = '22px Arial, sans-serif'
      ctx.fillStyle = '#4B5563'
      const textWidth = ctx.measureText(trustText).width
      const lockSize = 18
      const lockGap = 10
      const trustY = 1412
      const lockX = (width / 2) - (textWidth / 2) - lockGap - lockSize
      const lockY = trustY - lockSize + 2

      ctx.strokeStyle = '#4B5563'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(lockX, lockY + 6, lockSize, lockSize - 4, 3)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(lockX + lockSize / 2, lockY + 6, lockSize / 3.2, Math.PI, 0)
      ctx.stroke()
      ctx.fillText(trustText, width / 2, trustY)

      ctx.fillStyle = '#111827'
      ctx.font = 'italic 42px Arial, sans-serif'
      ctx.fillText(stageName, width / 2, 1535)

      if (logo.complete && logo.naturalHeight > 0) {
        const logoHeight = 320
        const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight
        const padding = 40
        const logoX = width - logoWidth - padding
        const logoY = 1540
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight)
      }

      console.log('[QR] Canvas rendering complete, converting to blob...')
      canvas.toBlob((blob) => {
        console.log('[QR] toBlob callback executed. Blob:', blob)
        if (blob) {
          console.log('[QR] Blob size:', blob.size, 'type:', blob.type)
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `tipwave-card-${nickname || deviceId}.png`
          document.body.appendChild(a)
          console.log('[QR] Triggering download...')
          a.click()
          window.URL.revokeObjectURL(url)
          window.URL.revokeObjectURL(qrBlobUrl)
          document.body.removeChild(a)
          console.log('[QR] Download complete!')
          setIsDownloadingQR(false)
        } else {
          console.error('[QR] Blob is null!')
          alert('Failed to create download file')
          setIsDownloadingQR(false)
        }
      }, 'image/png')
    } catch (error) {
      console.error('[QR] Download error:', error)
      logger.error('[QR] Download error:', error)
      alert(`QR code download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsDownloadingQR(false)
    }
  }

  const openConfigureModal = (device: PerformerDevice) => {
    setSelectedDevice(device)
    setShowConfigModal(true)
  }

  const handleConfigSave = async () => {
    setShowConfigModal(false)
    setSelectedDevice(null)
    
    // Reload both insights and performer data to get updated device configuration
    if (selectedPerformer) {
      console.log('[Config] Reloading performer data after save...')
      
      // Reload insights
      await loadPerformerInsights(selectedPerformer.id)
      
      // Re-fetch the performer with devices to get updated configuration
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(
          `${API_BASE_URL}/api/admin/performers/search-devices?q=${encodeURIComponent(selectedPerformer.email)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
        
        if (response.ok) {
          const data: PerformerSearchResult[] = await response.json()
          const updatedPerformer = data.find(p => p.id === selectedPerformer.id)
          if (updatedPerformer) {
            console.log('[Config] Performer data refreshed. Updated devices:', updatedPerformer.devices)
            setSelectedPerformer(updatedPerformer)
            
            // Update the allPerformers array as well
            setAllPerformers(prev => prev.map(p => 
              p.id === updatedPerformer.id ? updatedPerformer : p
            ))
          }
        }
      } catch (error) {
        logger.error('Error refreshing performer data:', error)
      }
    }
  }

  // Prepare weekly chart data
  const weeklyChartData = insights?.weeklyTips.map(week => ({
    week: new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    totalTips: week.totalAmount,
    uniqueAudience: week.uniqueTippers
  })) || []

  // Generate trend line for weekly chart
  const calculateTrendLine = () => {
    if (!weeklyChartData.length) return []
    const n = weeklyChartData.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    
    weeklyChartData.forEach((point, index) => {
      sumX += index
      sumY += point.totalTips
      sumXY += index * point.totalTips
      sumX2 += index * index
    })
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    return weeklyChartData.map((point, index) => ({
      week: point.week,
      trend: slope * index + intercept
    }))
  }

  const trendData = calculateTrendLine()

  // Set default time window (last 10 hours)
  useEffect(() => {
    if (startDateTime || endDateTime) return

    const now = new Date()
    const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000)

    const formatDateTime = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    setStartDateTime(formatDateTime(tenHoursAgo))
    setEndDateTime(formatDateTime(now))
  }, [startDateTime, endDateTime])

  // Filter tips by time window
  useEffect(() => {
    if (!tipTimelinePoints.length) {
      setFilteredTipPoints([])
      return
    }

    if (!startDateTime || !endDateTime) {
      setFilteredTipPoints(tipTimelinePoints)
      return
    }

    const start = new Date(startDateTime).getTime()
    const end = new Date(endDateTime).getTime()

    const points = tipTimelinePoints.filter(point =>
      point.timestamp >= start && point.timestamp <= end
    )

    setFilteredTipPoints(points)
  }, [tipTimelinePoints, startDateTime, endDateTime])

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      {!selectedPerformer && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Performers</h3>
          <AutoComplete
            value={searchTerm}
            options={searchOptions}
            onSearch={handleSearch}
            onSelect={handleSelect}
            placeholder="Type performer name, stage name, or email..."
            style={{ width: '100%' }}
            size="large"
            notFoundContent={isSearching ? 'Searching...' : searchTerm.length < 2 ? 'Type at least 2 characters' : 'No performers found'}
          />
          <p className="text-sm text-gray-500 mt-2">
            Start typing to search by name, stage name, or email address
          </p>
        </div>
      )}

      {/* Performer Insights Dashboard */}
      {selectedPerformer && (
        <div className="space-y-6">
          {/* Header with Back Button */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button
              onClick={handleBack}
              className="mb-4 text-purple-600 hover:text-purple-800 flex items-center gap-2"
            >
              <span>←</span> Back to Search
            </button>
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedPerformer.stageName || `${selectedPerformer.firstName} ${selectedPerformer.lastName}`}
            </h2>
            <p className="text-sm text-gray-500">{selectedPerformer.email}</p>
            <p className="text-xs text-gray-400 mt-1">
              {selectedPerformer.devices?.length || 0} device(s)
            </p>
            
            {/* Device Actions */}
            <div className="mt-4 flex gap-3">
              {selectedPerformer.devices && selectedPerformer.devices.length > 0 ? (
                <>
                  <button
                    onClick={() => downloadQRCode(selectedPerformer.devices[0].id, selectedPerformer.devices[0].nickname || '')}
                    disabled={isDownloadingQR}
                    className={`px-4 py-2 text-white rounded-lg transition-all ${
                      isDownloadingQR 
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isDownloadingQR ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </span>
                    ) : 'Download QR Code'}
                  </button>
                  <button
                    onClick={() => openConfigureModal(selectedPerformer.devices[0])}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    Configure Device
                  </button>
                </>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  No devices registered for this performer
                </div>
              )}
            </div>
          </div>

          {isLoadingInsights ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading insights...</p>
            </div>
          ) : insights ? (
            <>
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Today's Tips</div>
                  <div className="text-2xl font-bold text-gray-900">${(insights.metrics?.todaysTips || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Future Payouts</div>
                  <div className="text-2xl font-bold text-gray-900">${(insights.futurePayouts || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">In Transit</div>
                  <div className="text-2xl font-bold text-gray-900">${(insights.inTransit || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Total Balance</div>
                  <div className="text-2xl font-bold text-gray-900">${(insights.totalBalance || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Lifetime Volume</div>
                  <div className="text-2xl font-bold text-gray-900">${(insights.metrics?.stripeLifetimeVolume || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Audience</div>
                  <div className="text-2xl font-bold text-gray-900">{(insights.uniqueTippersAllTime || 0).toLocaleString()}</div>
                  <div className="text-xs text-gray-400">Unique Tippers</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Most Tipped</div>
                  <div className="text-2xl font-bold text-gray-900">${(insights.mostTippedDenomination || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-400">Denomination</div>
                </div>
              </div>

              {/* Weekly Tips Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Last 8 Weeks Performance</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis yAxisId="left" domain={[0, 'auto']} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                              <p className="font-medium">{payload[0].payload.week}</p>
                              <p className="text-sm text-blue-600">Total Tips: ${payload[0].value?.toFixed(2)}</p>
                              <p className="text-sm text-green-600">Unique Audience: {payload[0].payload.uniqueAudience}</p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="totalTips" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      name="Total Tips ($)"
                    />
                    {trendData.length > 0 && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        data={trendData}
                        dataKey="trend"
                        stroke="#d1d5db"
                        strokeWidth={2}
                        strokeDasharray="0"
                        name="Trend"
                        dot={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Time Window Tips Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tips by Time Window</h3>
                
                {/* Date/Time Range Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date/Time</label>
                    <input
                      type="datetime-local"
                      value={startDateTime}
                      onChange={(e) => setStartDateTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date/Time</label>
                    <input
                      type="datetime-local"
                      value={endDateTime}
                      onChange={(e) => setEndDateTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      name="Time"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      dataKey="amount" 
                      name="Amount ($)"
                    />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                              <p className="font-medium">{payload[0].payload.time}</p>
                              <p className="text-sm text-green-600">Amount: ${payload[0].payload.amount.toFixed(2)}</p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Scatter 
                      name="Tips" 
                      data={filteredTipPoints} 
                      fill="#8b5cf6"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
                
                <p className="text-sm text-gray-500 mt-4">
                  Showing {filteredTipPoints.length} tips in the selected time window
                </p>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Configure Device Modal */}
      {showConfigModal && selectedDevice && (
        <DeviceConfigModal
          device={selectedDevice}
          onClose={() => {
            setShowConfigModal(false)
            setSelectedDevice(null)
          }}
          onSave={handleConfigSave}
        />
      )}
    </div>
  )
}

// Device Config Modal Component
const DeviceConfigModal: React.FC<{
  device: PerformerDevice
  onClose: () => void
  onSave: () => void
}> = ({ device, onClose, onSave }) => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(device.isSoundEnabled || false)
  const [isRandomEffect, setIsRandomEffect] = useState(device.isRandomLightEffect || false)
  const [effectConfig, setEffectConfig] = useState<Record<string, string>>(() => {
    try {
      if (device.effectConfiguration) {
        return JSON.parse(device.effectConfiguration)
      }
    } catch (e) {
      logger.error('Error parsing effect configuration:', e)
    }
    return {
      "2": "effect1",
      "5": "effect1",
      "10": "effect2",
      "20": "effect2",
      "50": "effect3",
      "100": "effect3"
    }
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      console.log('[Config] Starting save...', { deviceId: device.id, isSoundEnabled, isRandomEffect })
      const token = localStorage.getItem('token')
      const requestBody = {
        isSoundEnabled,
        isRandomLightEffect: isRandomEffect,
        effectConfiguration: JSON.stringify(effectConfig)
      }
      console.log('[Config] Request body:', requestBody)
      
      const response = await fetch(`${API_BASE_URL}/api/admin/devices/${device.id}/configuration`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      console.log('[Config] Response status:', response.status, response.statusText)
      
      if (response.ok) {
        const data = await response.json()
        console.log('[Config] Response data:', data)
        if (data.success) {
          console.log('[Config] Save successful!')
          onSave()
        } else {
          logger.error('Failed to save configuration - no success flag')
          alert('Failed to update device configuration')
        }
      } else {
        const errorText = await response.text()
        console.error('[Config] Error response:', errorText)
        logger.error('Failed to save configuration')
        alert('Failed to update device configuration: ' + response.statusText)
      }
    } catch (error) {
      console.error('[Config] Exception:', error)
      logger.error('Error saving configuration:', error)
      alert('Error updating device configuration: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  const amounts = [2, 5, 10, 20, 50, 100]
  const effects = ['effect1', 'effect2', 'effect3']
  const effectNames: Record<string, string> = {
    'effect1': 'Flash',
    'effect2': 'Swirl',
    'effect3': 'Breathing'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Configure Device: {device.nickname || device.serialNumber}
        </h3>
        
        <div className="space-y-6">
          {/* Sound Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Sound Enabled</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSoundEnabled}
                onChange={(e) => setIsSoundEnabled(e.target.checked)}
                disabled={isSaving}
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
                checked={isRandomEffect}
                onChange={(e) => setIsRandomEffect(e.target.checked)}
                disabled={isSaving}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Effect Configuration */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Light Effects by Amount</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {amounts.map(amount => (
                <div key={amount} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">${amount}</span>
                  <select
                    value={effectConfig[amount.toString()] || 'effect1'}
                    onChange={(e) => {
                      setEffectConfig(prev => ({ ...prev, [amount.toString()]: e.target.value }))
                    }}
                    disabled={isSaving}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {effects.map(effect => (
                      <option key={effect} value={effect}>
                        {effectNames[effect]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PerformerInsights
