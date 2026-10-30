import React, { useState, useEffect, useRef, useCallback } from 'react'
import { renderQrCard } from '../utils/qrCard'
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AutoComplete } from 'antd'
import type { BaseOptionType } from 'antd/es/select'
import logger from '../utils/logger'
import { Button, Modal, Switch, useFeedback } from './ui'
import { API_BASE_URL } from '../utils/config'
import apiService from '../services/api'
import { DEFAULT_TIP_AMOUNTS, LIGHT_EFFECTS, SOUND_OPTIONS, VOLUME_OPTIONS, DEFAULT_SOUND_ID, DEFAULT_SOUND_VOLUME, normalizeEffectConfig, effectForAmount, buildEffectConfig } from '../utils/deviceConfig'
import TipAmountsEditor from './TipAmountsEditor'

interface PerformerDevice {
  id: string
  serialNumber?: string
  nickname?: string
  isDeleted: boolean
  createdAt: string
  isSoundEnabled?: boolean
  isRandomLightEffect?: boolean
  soundId?: number
  soundVolume?: string
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
  const { toast } = useFeedback()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchOptions, setSearchOptions] = useState<BaseOptionType[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPerformer, setSelectedPerformer] = useState<PerformerSearchResult | null>(null)
  const [performerTipAmounts, setPerformerTipAmounts] = useState<number[]>(DEFAULT_TIP_AMOUNTS)
  const [tipAmountsSaving, setTipAmountsSaving] = useState(false)
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

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
              <div className="font-medium text-ink-900">
                {performer.firstName} {performer.lastName}
                {performer.stageName && <span className="text-brand-700 ml-2">({performer.stageName})</span>}
              </div>
              <div className="text-sm text-ink-500">{performer.email}</div>
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

  const loadPerformerTipAmounts = async (performerId: string) => {
    const response = await apiService.get(`/api/admin/performers/${performerId}/tip-amounts`)
    setPerformerTipAmounts(response.data?.amounts ?? DEFAULT_TIP_AMOUNTS)
  }

  const savePerformerTipAmounts = async (amounts: number[]) => {
    if (!selectedPerformer) return
    setTipAmountsSaving(true)
    try {
      const response = await apiService.put(`/api/admin/performers/${selectedPerformer.id}/tip-amounts`, { amounts })
      if (response.data?.amounts) {
        setPerformerTipAmounts(response.data.amounts)
      } else {
        toast('Failed to save tip amounts: ' + (response.error || 'Unknown error'), 'error')
      }
    } finally {
      setTipAmountsSaving(false)
    }
  }

  const resetPerformerTipAmounts = async () => {
    if (!selectedPerformer) return
    setTipAmountsSaving(true)
    try {
      const response = await apiService.delete(`/api/admin/performers/${selectedPerformer.id}/tip-amounts`)
      if (response.data?.amounts) {
        setPerformerTipAmounts(response.data.amounts)
      } else {
        toast('Failed to reset tip amounts: ' + (response.error || 'Unknown error'), 'error')
      }
    } finally {
      setTipAmountsSaving(false)
    }
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
      loadPerformerTipAmounts(performer.id)
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
    setPerformerTipAmounts(DEFAULT_TIP_AMOUNTS)
    setInsights(null)
    setSearchTerm('')
    setSearchOptions([])
  }

  const downloadQRCode = async (deviceId: string, nickname: string) => {
    setIsDownloadingQR(true)
    try {
      console.info('[QR] Download clicked', { deviceId, nickname })
      console.info('[QR] API URL:', `${API_BASE_URL}/api/devices/${deviceId}/qr`)
      console.info('[QR] Fetching QR code from backend...')
      const qrBlob = await apiService.downloadQRCode(deviceId)
      
      if (!qrBlob) {
        console.error('[QR] Blob is null or undefined')
        toast('Could not download QR code. Please try again or check your connection.', 'error')
        setIsDownloadingQR(false)
        return
      }

      console.info('[QR] Blob received:', { size: qrBlob.size, type: qrBlob.type })

      if (!qrBlob.type.startsWith('image/')) {
        toast(`QR download returned a non-image content-type: ${qrBlob.type || 'unknown'}`, 'error')
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
        toast('Could not generate the branded card. Downloaded the raw QR instead.', 'info')
        setIsDownloadingQR(false)
        return
      }

      const stageName = selectedPerformer?.stageName || `${selectedPerformer?.firstName || ''} ${selectedPerformer?.lastName || ''}`.trim() || 'Performer'
      console.log('[QR] Stage name:', stageName)

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
        setIsDownloadingQR(false)
        return
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
          toast('Failed to create download file', 'error')
          setIsDownloadingQR(false)
        }
      }, 'image/png')
    } catch (error) {
      console.error('[QR] Download error:', error)
      logger.error('[QR] Download error:', error)
      toast(`QR code download failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
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
          <h3 className="text-lg font-semibold text-ink-900 mb-4">Search Performers</h3>
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
          <p className="text-sm text-ink-500 mt-2">
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
              className="mb-4 text-brand-700 hover:text-brand-800 flex items-center gap-2"
            >
              <span>←</span> Back to Search
            </button>
            <h2 className="text-2xl font-bold text-ink-900">
              {selectedPerformer.stageName || `${selectedPerformer.firstName} ${selectedPerformer.lastName}`}
            </h2>
            <p className="text-sm text-ink-500">{selectedPerformer.email}</p>
            <p className="text-xs text-ink-400 mt-1">
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
                        ? 'bg-brand-400 cursor-not-allowed' 
                        : 'bg-brand-700 hover:bg-brand-800'
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
                <div className="text-sm text-ink-500 italic">
                  No devices registered for this performer
                </div>
              )}
            </div>
          </div>

          <TipAmountsEditor
            amounts={performerTipAmounts}
            saving={tipAmountsSaving}
            onSave={savePerformerTipAmounts}
            onReset={resetPerformerTipAmounts}
          />

          {isLoadingInsights ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700 mx-auto"></div>
              <p className="mt-4 text-ink-500">Loading insights...</p>
            </div>
          ) : insights ? (
            <>
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-ink-500">Today's Tips</div>
                  <div className="text-2xl font-bold text-ink-900">${(insights.metrics?.todaysTips || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-ink-500">Future Payouts</div>
                  <div className="text-2xl font-bold text-ink-900">${(insights.futurePayouts || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-ink-500">In Transit</div>
                  <div className="text-2xl font-bold text-ink-900">${(insights.inTransit || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-ink-500">Total Balance</div>
                  <div className="text-2xl font-bold text-ink-900">${(insights.totalBalance || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-ink-500">Lifetime Volume</div>
                  <div className="text-2xl font-bold text-ink-900">${(insights.metrics?.stripeLifetimeVolume || 0).toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-ink-500">Audience</div>
                  <div className="text-2xl font-bold text-ink-900">{(insights.uniqueTippersAllTime || 0).toLocaleString()}</div>
                  <div className="text-xs text-ink-400">Unique Tippers</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-ink-500">Most Tipped</div>
                  <div className="text-2xl font-bold text-ink-900">${(insights.mostTippedDenomination || 0).toFixed(2)}</div>
                  <div className="text-xs text-ink-400">Denomination</div>
                </div>
              </div>

              {/* Weekly Tips Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-ink-900 mb-4">Last 8 Weeks Performance</h3>
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
                            <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
                              <p className="font-medium">{payload[0].payload.week}</p>
                              <p className="text-sm text-brand-700">Total Tips: ${payload[0].value?.toFixed(2)}</p>
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
                      stroke="#0891A6" 
                      strokeWidth={2}
                      name="Total Tips ($)"
                    />
                    {trendData.length > 0 && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        data={trendData}
                        dataKey="trend"
                        stroke="#CBD5E1"
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
                <h3 className="text-lg font-semibold text-ink-900 mb-4">Tips by Time Window</h3>
                
                {/* Date/Time Range Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-2">Start Date/Time</label>
                    <input
                      type="datetime-local"
                      value={startDateTime}
                      onChange={(e) => setStartDateTime(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-2">End Date/Time</label>
                    <input
                      type="datetime-local"
                      value={endDateTime}
                      onChange={(e) => setEndDateTime(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600"
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
                            <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
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
                      fill="#0891A6"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
                
                <p className="text-sm text-ink-500 mt-4">
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
          tipAmounts={performerTipAmounts}
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
  tipAmounts: number[]
  onClose: () => void
  onSave: () => void
}> = ({ device, tipAmounts, onClose, onSave }) => {
  const { toast } = useFeedback()
  const [isSoundEnabled, setIsSoundEnabled] = useState(device.isSoundEnabled || false)
  const [isRandomEffect, setIsRandomEffect] = useState(device.isRandomLightEffect || false)
  const [soundId, setSoundId] = useState(device.soundId ?? DEFAULT_SOUND_ID)
  const [soundVolume, setSoundVolume] = useState(device.soundVolume ?? DEFAULT_SOUND_VOLUME)
  const [effectConfig, setEffectConfig] = useState<Record<string, string>>(() => {
    try {
      if (device.effectConfiguration) {
        return normalizeEffectConfig(JSON.parse(device.effectConfiguration))
      }
    } catch (e) {
      logger.error('Error parsing effect configuration:', e)
    }
    return {}
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
        soundId,
        soundVolume,
        effectConfiguration: JSON.stringify(buildEffectConfig(effectConfig, tipAmounts))
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
          toast('Failed to update device configuration', 'error')
        }
      } else {
        const errorText = await response.text()
        console.error('[Config] Error response:', errorText)
        logger.error('Failed to save configuration')
        toast('Failed to update device configuration: ' + response.statusText, 'error')
      }
    } catch (error) {
      console.error('[Config] Exception:', error)
      logger.error('Error saving configuration:', error)
      toast('Error updating device configuration: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open
      title={`Configure device: ${device.nickname || device.serialNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            Save changes
          </Button>
        </>
      }
    >
        <div className="space-y-6">
          {/* Sound Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700">Sound Enabled</span>
            <Switch checked={isSoundEnabled} disabled={isSaving} label="Sound enabled" onChange={() => setIsSoundEnabled(!isSoundEnabled)} />
          </div>

          {/* Sound Selection (Prototype3) */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700">Sound</span>
            <select
              value={soundId}
              onChange={(e) => setSoundId(Number(e.target.value))}
              disabled={isSaving || !isSoundEnabled}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              {SOUND_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Sound Volume (Prototype3) - disabled while sound is off */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700">Sound Volume</span>
            <select
              value={soundVolume}
              onChange={(e) => setSoundVolume(e.target.value)}
              disabled={isSaving || !isSoundEnabled}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              {VOLUME_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Random Light Effect Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700">Random Light Effect</span>
            <Switch checked={isRandomEffect} disabled={isSaving} label="Random light effect" onChange={() => setIsRandomEffect(!isRandomEffect)} />
          </div>

          {/* Effect Configuration */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-ink-700">Light Effects by Amount</h4>
            <div className="bg-surface rounded-lg p-4 space-y-3">
              {tipAmounts.map(amount => (
                <div key={amount} className="flex items-center justify-between">
                  <span className="text-sm text-ink-500 font-medium">${amount}</span>
                  <select
                    value={effectForAmount(effectConfig, amount)}
                    onChange={(e) => {
                      setEffectConfig(prev => ({ ...prev, [amount.toString()]: e.target.value }))
                    }}
                    disabled={isSaving}
                    className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    {LIGHT_EFFECTS.map(effect => (
                      <option key={effect.value} value={effect.value}>
                        {effect.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
    </Modal>
  )
}

export default PerformerInsights
