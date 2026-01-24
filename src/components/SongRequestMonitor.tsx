import logger from "../utils/logger";
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_BASE_URL } from '../utils/config'

interface SongRequest {
  songId: string
  songTitle: string
  artist: string
  status: 'pending' | 'performing' | 'completed' | 'cancelled' | 'skipped'
  totalTipAmount: number
  requestCount: number
  firstRequestTime: string
  lastRequestTime: string
  requestIds: string[]
  requestorName?: string
  note?: string
}

interface SongRequestMonitorProps {
  profileId: string
  isVisible: boolean
  onClose: () => void
}

const SongRequestMonitor: React.FC<SongRequestMonitorProps> = ({
  profileId,
  isVisible,
  onClose
}) => {
  const [songRequests, setSongRequests] = useState<SongRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const refreshIntervalRef = useRef<number | null>(null)

  // Auto-refresh every 5 seconds for live updates
  useEffect(() => {
    if (isVisible) {
      loadSongRequests()
      
      refreshIntervalRef.current = setInterval(() => {
        loadSongRequests()
        setLastRefresh(new Date())
      }, 5000)
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
      }
    }
  }, [isVisible, profileId])

  // Prevent body scroll when visible
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'auto'
      }
    }
  }, [isVisible])

  const loadSongRequests = async () => {
    if (!profileId) return
    
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      // Add cache-busting query parameter to ensure fresh data
      const cacheBuster = Date.now()
      const response = await fetch(`${API_BASE_URL}/api/SongCatalog/monitor/${profileId}?_t=${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setSongRequests(data.songRequests || [])
      } else {
        const errorText = await response.text()
        logger.error(`🔴 [Monitor] Failed to load song requests: ${response.status} ${response.statusText}`, errorText)
      }
    } catch (error) {
      logger.error('🔴 [Monitor] Error loading song requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateSongStatus = async (request: SongRequest, newStatus: 'pending' | 'performing' | 'completed' | 'cancelled' | 'skipped') => {
    const requestKey = request.requestIds.join('-')
    setUpdatingStatus(requestKey)
    
    try {
      logger.log('Updating song status:', { 
        songId: request.songId, 
        status: newStatus, 
        requestIds: request.requestIds,
        profileId 
      })
      
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/SongCatalog/monitor/update-status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profileId,
          songId: request.songId,
          requestIds: request.requestIds,
          status: newStatus
        })
      })

      logger.log('Response status:', response.status, response.statusText)

      if (response.ok) {
        const result = await response.json()
        logger.log('Update successful:', result)
        
        // Update local state immediately for responsive UI
        setSongRequests(prev => prev.map(r => 
          r.requestIds.join('-') === request.requestIds.join('-')
            ? { ...r, status: newStatus }
            : r
        ))
        
        // Refresh to get latest data
        setTimeout(() => {
          loadSongRequests()
        }, 1000)
      } else {
        const errorText = await response.text()
        logger.error('Failed to update status:', response.status, errorText)
      }
    } catch (error) {
      logger.error('Error updating song status:', error)
    } finally {
      setUpdatingStatus(null)
    }
  }

  // Sort requests: performing at the top, then pending by tip amount (highest first), then completed
  const sortedRequests = [...songRequests].sort((a, b) => {
    const statusOrder = { performing: 0, pending: 1, completed: 2, cancelled: 3, skipped: 4 }
    
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status]
    }
    
    // For same status, sort by tip amount (highest first)
    if (a.totalTipAmount !== b.totalTipAmount) {
      return b.totalTipAmount - a.totalTipAmount
    }
    
    return new Date(a.firstRequestTime).getTime() - new Date(b.firstRequestTime).getTime()
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200 text-green-800'
      case 'performing': return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'cancelled': return 'bg-gray-50 border-gray-200 text-gray-800'
      case 'skipped': return 'bg-red-50 border-red-200 text-red-800'
      default: return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'performing': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      case 'skipped': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-0 bg-gradient-to-br from-gray-50 to-blue-50 z-50 flex flex-col"
        >
          {/* Header */}
          <div className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-gray-200">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="font-medium">Return to Dashboard</span>
                </motion.button>

                <div className="text-right">
                  <div className="text-sm text-gray-500">Auto-refresh</div>
                  <div className="font-semibold text-blue-600 text-xs">
                    {lastRefresh.toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  🎵 Song Request Monitor
                </h1>
                <div className="flex items-center justify-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span className="text-gray-600">
                      Pending ({sortedRequests.filter(r => r.status === 'pending').length})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                    <span className="text-gray-600">
                      Performing ({sortedRequests.filter(r => r.status === 'performing').length})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="text-gray-600">
                      Completed ({sortedRequests.filter(r => r.status === 'completed').length})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-600">
                      Cancelled ({sortedRequests.filter(r => r.status === 'cancelled').length})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span className="text-gray-600">
                      Skipped ({sortedRequests.filter(r => r.status === 'skipped').length})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6">
              {loading && sortedRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading song requests...</p>
                </div>
              ) : sortedRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No song requests today</h3>
                  <p className="text-gray-600 max-w-sm mx-auto">
                    Song requests will appear here when participants make them through the tip interface
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {sortedRequests.map((request, index) => {
                      const requestKey = request.requestIds.join('-')
                      return (
                        <motion.div
                          key={requestKey}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`border rounded-xl shadow-sm overflow-hidden ${getStatusColor(request.status)}`}
                        >
                          <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {request.songTitle}
                              </h3>
                              <p className="text-gray-700 mb-3">by {request.artist}</p>
                              
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <div className="flex items-center space-x-1">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                  </svg>
                                  <span className="font-semibold text-green-700">
                                    ${request.totalTipAmount.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  <span>{request.requestCount} request{request.requestCount > 1 ? 's' : ''}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>{new Date(request.firstRequestTime).toLocaleTimeString()}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end space-y-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(request.status)}`}>
                                {request.status === 'completed' ? 'Completed' : 
                                 request.status === 'performing' ? 'Performing' : 
                                 request.status === 'cancelled' ? 'Cancelled' :
                                 request.status === 'skipped' ? 'Skipped' : 'Pending'}
                              </span>
                            </div>
                            </div>

                            {/* Optional Requestor Info */}
                            {(request.requestorName || request.note) && (
                              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                {request.requestorName && (
                                  <div className="flex items-center space-x-2 mb-2">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">From: {request.requestorName}</span>
                                  </div>
                                )}
                                {request.note && (
                                  <div className="flex items-start space-x-2">
                                    <svg className="w-4 h-4 text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    <span className="text-sm text-gray-600 leading-relaxed">{request.note}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Action Buttons - Simplified Logic */}
                            <div className="mt-4 flex justify-center">
                            {request.status === 'pending' && (
                              <motion.button
                                onClick={() => updateSongStatus(request, 'performing')}
                                disabled={updatingStatus === requestKey}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {updatingStatus === requestKey ? 'Updating...' : 'Start Performing'}
                              </motion.button>
                            )}
                            
                            {request.status === 'performing' && (
                              <motion.button
                                onClick={() => updateSongStatus(request, 'completed')}
                                disabled={updatingStatus === requestKey}
                                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {updatingStatus === requestKey ? 'Updating...' : 'Mark Completed'}
                              </motion.button>
                            )}
                            
                            {/* No buttons for completed status */}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SongRequestMonitor 