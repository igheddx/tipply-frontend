import React, { useState, useEffect } from 'react'
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import logger from '../utils/logger'
import { API_BASE_URL } from '../utils/config'

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

interface PerformerInsights {
  metrics: {
    todayTips: number
    totalTips: number
    averageTip: number
  }
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
  const [searchResults, setSearchResults] = useState<PerformerSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedPerformer, setSelectedPerformer] = useState<PerformerSearchResult | null>(null)
  const [insights, setInsights] = useState<PerformerInsights | null>(null)
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<PerformerDevice | null>(null)
  
  // Time window filter for hourly chart
  const [startDateTime, setStartDateTime] = useState('')
  const [endDateTime, setEndDateTime] = useState('')
  const [filteredTipPoints, setFilteredTipPoints] = useState<TipPoint[]>([])

  const resultsPerPage = 5

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    setIsSearching(true)
    setCurrentPage(1)
    setSelectedPerformer(null)
    setInsights(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_BASE_URL}/api/admin/performers-with-devices/search?q=${encodeURIComponent(searchTerm)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        logger.error('Failed to search performers')
        setSearchResults([])
      }
    } catch (error) {
      logger.error('Error searching performers:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
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
    } catch (error) {
      logger.error('Error loading insights:', error)
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const handleViewPerformer = (performer: PerformerSearchResult) => {
    setSelectedPerformer(performer)
    loadPerformerInsights(performer.id)
  }

  const downloadQRCode = async (deviceId: string, nickname: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/qr`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tipwave-qr-${nickname || deviceId}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      logger.error('Error downloading QR code:', error)
    }
  }

  const openConfigureModal = (device: PerformerDevice) => {
    setSelectedDevice(device)
    setShowConfigModal(true)
  }

  const handleConfigSave = async () => {
    // Reload insights after config save
    if (selectedPerformer) {
      await loadPerformerInsights(selectedPerformer.id)
    }
    setShowConfigModal(false)
    setSelectedDevice(null)
  }

  // Pagination
  const totalPages = Math.ceil(searchResults.length / resultsPerPage)
  const startIndex = (currentPage - 1) * resultsPerPage
  const endIndex = startIndex + resultsPerPage
  const currentResults = searchResults.slice(startIndex, endIndex)

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

  // Filter tips by time window
  useEffect(() => {
    if (insights?.hourlyTips && startDateTime && endDateTime) {
      const start = new Date(startDateTime).getTime()
      const end = new Date(endDateTime).getTime()
      
      // Generate tip points from hourly data (simulated as 30-min intervals)
      const points: TipPoint[] = []
      insights.hourlyTips.forEach(hourData => {
        // Create points within each hour at 30-min intervals
        for (let i = 0; i < hourData.tipsCount; i++) {
          const minuteOffset = Math.random() * 60 // Random within the hour
          const timestamp = start + (hourData.hour * 60 + minuteOffset) * 60 * 1000
          
          if (timestamp >= start && timestamp <= end) {
            points.push({
              time: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              amount: hourData.averageAmount,
              timestamp
            })
          }
        }
      })
      
      setFilteredTipPoints(points.sort((a, b) => a.timestamp - b.timestamp))
    }
  }, [insights, startDateTime, endDateTime])

  // Set default time window (last event - 8 hours)
  useEffect(() => {
    if (!startDateTime && !endDateTime) {
      const now = new Date()
      const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000)
      setStartDateTime(eightHoursAgo.toISOString().slice(0, 16))
      setEndDateTime(now.toISOString().slice(0, 16))
    }
  }, [startDateTime, endDateTime])

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, stage name, or device serial number..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Search Results Table */}
      {searchResults.length > 0 && !selectedPerformer && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device Serial
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentResults.map((performer) => (
                  <tr key={performer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {performer.firstName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {performer.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {performer.stageName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {performer.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {performer.devices.map(d => d.serialNumber).filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {performer.devices.length > 0 && (
                        <>
                          <button
                            onClick={() => downloadQRCode(performer.devices[0].id, performer.devices[0].nickname || '')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Download QR
                          </button>
                          <button
                            onClick={() => openConfigureModal(performer.devices[0])}
                            className="text-yellow-600 hover:text-yellow-800"
                          >
                            Configure
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleViewPerformer(performer)}
                        className="text-purple-600 hover:text-purple-800 font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(endIndex, searchResults.length)} of {searchResults.length} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-100"
                >
                  Previous
                </button>
                <span className="px-3 py-1">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performer Insights Dashboard */}
      {selectedPerformer && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedPerformer.stageName || `${selectedPerformer.firstName} ${selectedPerformer.lastName}`}
            </h2>
            <p className="text-sm text-gray-500">{selectedPerformer.email}</p>
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
                  <div className="text-2xl font-bold text-gray-900">${insights.metrics.todayTips.toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Future Payouts</div>
                  <div className="text-2xl font-bold text-gray-900">${insights.futurePayouts.toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">In Transit</div>
                  <div className="text-2xl font-bold text-gray-900">${insights.inTransit.toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Total Balance</div>
                  <div className="text-2xl font-bold text-gray-900">${insights.totalBalance.toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Lifetime Volume</div>
                  <div className="text-2xl font-bold text-gray-900">${insights.metrics.totalTips.toFixed(2)}</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Audience</div>
                  <div className="text-2xl font-bold text-gray-900">{insights.uniqueTippersAllTime.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">Unique Tippers</div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="text-sm text-gray-500">Most Tipped</div>
                  <div className="text-2xl font-bold text-gray-900">${insights.mostTippedDenomination}</div>
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
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
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
  const [effectConfig, setEffectConfig] = useState(() => {
    try {
      return device.effectConfiguration ? JSON.parse(device.effectConfiguration) : {}
    } catch {
      return {}
    }
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/configuration`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isSoundEnabled,
          isRandomLightEffect: isRandomEffect,
          effectConfiguration: JSON.stringify(effectConfig)
        })
      })

      if (response.ok) {
        onSave()
      } else {
        logger.error('Failed to save configuration')
      }
    } catch (error) {
      logger.error('Error saving configuration:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Configure Device: {device.nickname || device.serialNumber}
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Sound Enabled</label>
            <input
              type="checkbox"
              checked={isSoundEnabled}
              onChange={(e) => setIsSoundEnabled(e.target.checked)}
              className="h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Random Light Effects</label>
            <input
              type="checkbox"
              checked={isRandomEffect}
              onChange={(e) => setIsRandomEffect(e.target.checked)}
              className="h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PerformerInsights
