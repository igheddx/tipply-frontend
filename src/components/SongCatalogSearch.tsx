import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_BASE_URL } from '../utils/config'

interface Song {
  id: string
  songTitle: string
  artist: string
  album: string
  genre: string
}

interface DailyTipSummary {
  totalAmount: number
  tipCount: number
  date: string
}

interface SongCatalogSearchProps {
  deviceUuid: string
  userTempId: string
  onSongSelect: (song: {id: string, title: string, artist: string, requestorName?: string, note?: string}) => void
  onBackToTip: () => void
  isVisible: boolean
}

const SongCatalogSearch: React.FC<SongCatalogSearchProps> = ({
  deviceUuid,
  userTempId,
  onSongSelect,
  onBackToTip,
  isVisible
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(false)
  const [performerName, setPerformerName] = useState('')
  const [dailyTotal, setDailyTotal] = useState<DailyTipSummary | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [requestorName, setRequestorName] = useState('')
  const [note, setNote] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus search input when component becomes visible
  useEffect(() => {
    if (isVisible && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 300) // Delay to allow transition to complete
    }
  }, [isVisible])

  // Load daily tip total
  useEffect(() => {
    if (isVisible && userTempId) {
      loadDailyTotal()
    }
  }, [isVisible, userTempId])

  const loadDailyTotal = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/songcatalog/daily-tips/${userTempId}`)
      if (response.ok) {
        const data = await response.json()
        setDailyTotal(data)
      }
    } catch (error) {
      console.error('Error loading daily total:', error)
    }
  }

  const searchSongs = async (query: string) => {
    if (!query.trim()) {
      setSongs([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    setHasSearched(true)
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/songcatalog/performer/${deviceUuid}?search=${encodeURIComponent(query)}&limit=50`
      )
      
      if (response.ok) {
        const data = await response.json()
        setSongs(data)
        const performerNameHeader = response.headers.get('X-Performer-Name')
        if (performerNameHeader && !performerName) {
          setPerformerName(performerNameHeader)
        }
      }
    } catch (error) {
      console.error('Error searching songs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchSongs(searchQuery)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const handleSongRequest = (song: Song) => {
    onSongSelect({
      id: song.id,
      title: song.songTitle,
      artist: song.artist,
      requestorName: requestorName.trim() || undefined,
      note: note.trim() || undefined
    })
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 bg-gradient-to-br from-purple-50 to-blue-50 z-50 flex flex-col"
        >
          {/* Header */}
          <div className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-gray-200">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onBackToTip}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="font-medium">Back to Tip</span>
                </motion.button>

                {dailyTotal && (
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Today's Tips</div>
                    <div className="font-semibold text-green-600">
                      ${dailyTotal.totalAmount.toFixed(2)} ({dailyTotal.tipCount})
                    </div>
                  </div>
                )}
              </div>

              {performerName && (
                <div className="text-center mb-4">
                  <h1 className="text-xl font-bold text-gray-900">
                    🎵 Request a Song from {performerName}
                  </h1>
                  <p className="text-gray-600 text-sm mt-1">
                    Search their catalog and make a request with your tip
                  </p>
                </div>
              )}

              {/* Search Input */}
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by song, artist, album, or genre..."
                  className="w-full px-4 py-3 pl-12 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm text-lg"
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full"
                    />
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto pb-4">
            <div className="px-6 py-4">
              {!hasSearched && !searchQuery.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    Start typing to search songs
                  </h3>
                  <p className="text-gray-600 max-w-sm mx-auto">
                    Type any part of a song title, artist name, album, or genre to find what you're looking for
                  </p>
                </motion.div>
              )}

              {hasSearched && songs.length === 0 && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">No songs found</h3>
                  <p className="text-gray-600">Try searching with different keywords</p>
                </motion.div>
              )}

              {/* Song Results */}
              <div className="space-y-3">
                <AnimatePresence>
                  {songs.map((song, index) => (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {song.songTitle}
                            </h3>
                            <p className="text-gray-600 text-sm truncate">
                              by {song.artist}
                            </p>
                            {song.album && (
                              <p className="text-gray-500 text-xs truncate mt-1">
                                Album: {song.album}
                              </p>
                            )}
                            {song.genre && (
                              <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                {song.genre}
                              </span>
                            )}
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSongRequest(song)}
                            className="ml-4 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-md"
                          >
                            Select Song
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Optional Fields - Bottom Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/95 backdrop-blur-sm border-t border-gray-200 px-6 py-4"
          >
            <div className="mb-3">
              <p className="text-xs text-gray-500 text-center mb-3">
                ✨ Optional: Add your name or a note with your request
              </p>
              
              <div className="space-y-3">
                {/* Name Field */}
                <div>
                  <input
                    type="text"
                    value={requestorName}
                    onChange={(e) => setRequestorName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full px-3 py-2 bg-white/80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm placeholder-gray-400"
                    maxLength={50}
                  />
                </div>

                {/* Note Field */}
                <div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note or special message (optional)"
                    rows={2}
                    className="w-full px-3 py-2 bg-white/80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm placeholder-gray-400 resize-none"
                    maxLength={200}
                  />
                  {note.length > 0 && (
                    <div className="text-xs text-gray-400 text-right mt-1">
                      {note.length}/200
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SongCatalogSearch 