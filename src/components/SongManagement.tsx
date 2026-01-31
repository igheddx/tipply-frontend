import logger from "../utils/logger";
import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../utils/config'

interface Song {
  id: string
  songTitle: string
  artist: string
  album: string
  genre: string
  isActive: boolean
  createdAt: string
}

interface BulkOperationResponse {
  successCount: number
  failureCount: number
  failures: Array<{
    songTitle: string
    artist: string
    reason: string
  }>
}

interface UploadSong {
  title: string
  artist: string
  album?: string
  genre?: string
}

interface BulkUploadResponse {
  addedCount: number
  duplicateCount: number
  failedCount: number
  addedSongs: UploadSong[]
  duplicateSongs: Array<UploadSong & { reason?: string }>
  failedSongs: Array<UploadSong & { reason?: string }>
}

interface SongManagementProps {
  profileId: string
}

const SongManagement: React.FC<SongManagementProps> = ({ profileId }) => {
  // State management
  const [activeView, setActiveView] = useState<'search' | 'upload' | 'catalog'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchArtist, setSearchArtist] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [myCatalog, setMyCatalog] = useState<Song[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCount, setCatalogCount] = useState<number>(0)
  
  // Upload states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedSongs, setParsedSongs] = useState<UploadSong[]>([])
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [uploadSummary, setUploadSummary] = useState<BulkUploadResponse | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  
  // Loading states
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [isAddingSong, setIsAddingSong] = useState<string | null>(null)
  const [isRemovingSong, setIsRemovingSong] = useState<string | null>(null)
  
  // Pagination
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalogTotalCount, setCatalogTotalCount] = useState(0)
  
  // Bulk operations
  const [selectedCatalogSongs, setSelectedCatalogSongs] = useState<Set<string>>(new Set())
  const [isBulkRemoving, setIsBulkRemoving] = useState(false)
  
  // Notifications
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const limit = 20

  // Refresh catalog count only (lightweight)
  const refreshCatalogCount = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/songcatalog/my-songs/${profileId}?page=1&limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Try to get count from header first, then fallback to counting the response array
        const headerCount = response.headers.get('X-Total-Count')
        let totalCount = 0
        
        if (headerCount) {
          totalCount = parseInt(headerCount, 10)
        } else {
          // Fallback: if header is not accessible, fetch without limit to count
          const fullResponse = await fetch(`${API_BASE_URL}/api/songcatalog/my-songs/${profileId}?page=1&limit=1000`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          if (fullResponse.ok) {
            const songs = await fullResponse.json()
            totalCount = Array.isArray(songs) ? songs.length : 0
          }
        }
        
        setCatalogTotalCount(totalCount)
        setCatalogCount(totalCount)
      }
    } catch (error) {
      logger.error('Error refreshing catalog count:', error)
    }
  }

  // Load user's catalog
  const loadMyCatalog = async (page = 1, search = '') => {
    setIsLoadingCatalog(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search })
      })
      
      const response = await fetch(`${API_BASE_URL}/api/songcatalog/my-songs/${profileId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const songs = await response.json()
        setMyCatalog(songs)
        
        // Try to get count from header first, then fallback to counting the response array
        const headerCount = response.headers.get('X-Total-Count')
        let totalCount = 0
        
        if (headerCount) {
          totalCount = parseInt(headerCount, 10)
        } else {
          // Fallback: if header is not accessible, fetch without limit to count
          try {
            const fullResponse = await fetch(`${API_BASE_URL}/api/songcatalog/my-songs/${profileId}?page=1&limit=1000`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })
            if (fullResponse.ok) {
              const allSongs = await fullResponse.json()
              totalCount = Array.isArray(allSongs) ? allSongs.length : 0
            }
          } catch (err) {
            logger.error('Error fetching full catalog for count:', err)
            // If fallback fails, use the current page's songs length as minimum
            totalCount = Array.isArray(songs) ? songs.length : 0
          }
        }
        
        setCatalogTotalCount(totalCount)
        setCatalogCount(totalCount)
      } else {
        showNotification('error', 'Failed to load your song catalog')
      }
    } catch (error) {
      logger.error('Error loading catalog:', error)
      showNotification('error', 'Failed to load your song catalog')
    } finally {
      setIsLoadingCatalog(false)
    }
  }

  // Search external songs
  const searchSongs = async (title: string, artist: string = '') => {
    if (!title.trim()) return
    
    setIsSearching(true)
    setSearchResults([])
    try {
      // Build query: pass title only; send artist separately
      const queryTitle = title.trim()
      const artistParam = artist.trim()
      const url = `${API_BASE_URL}/api/songcatalog/musicbrainz/search?query=${encodeURIComponent(queryTitle)}${artistParam ? `&artist=${encodeURIComponent(artistParam)}` : ''}&limit=20`
      
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
        if (data.length === 0) {
          showNotification('info', 'No songs found matching your criteria')
        }
      } else {
        showNotification('error', 'Failed to search songs')
      }
    } catch (error) {
      logger.error('Error searching songs:', error)
      showNotification('error', 'Failed to search songs')
    } finally {
      setIsSearching(false)
    }
  }

  // Add song to catalog
  const addSongToCatalog = async (song: any) => {
    setIsAddingSong(`${song.title}-${song.artist}`)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/songcatalog/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profileId,
          songTitle: song.title,
          artist: song.artist,
          album: song.album,
          genre: song.genre,
          musicBrainzId: song.id
        })
      })

      if (response.ok) {
        showNotification('success', `Added "${song.title}" to your catalog`)
        setSearchResults(prev => prev.map(s => 
          s.id === song.id 
            ? { ...s, isInCatalog: true }
            : s
        ))
        refreshCatalogCount()
      } else {
        const error = await response.json()
        showNotification('error', error.error || 'Failed to add song')
      }
    } catch (error) {
      logger.error('Error adding song:', error)
      showNotification('error', 'Failed to add song to catalog')
    } finally {
      setIsAddingSong(null)
    }
  }

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      searchSongs(searchQuery, searchArtist)
    }
  }

  // Handle catalog search
  const handleCatalogSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCatalogPage(1)
    loadMyCatalog(1, catalogSearch)
  }

  // Remove song from catalog
  const removeSongFromCatalog = async (songId: string) => {
    setIsRemovingSong(songId)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/songcatalog/${songId}?profileId=${profileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        showNotification('success', 'Song removed from catalog')
        // Optimistically update UI immediately
        setMyCatalog(prev => prev.filter(s => s.id !== songId))
        setCatalogTotalCount(prev => Math.max(0, prev - 1))
        setCatalogCount(prev => Math.max(0, prev - 1))

        // If current page becomes empty and we're not on the first page, go back a page
        setTimeout(() => {
          // Use latest values after state updates
          const totalAfter = catalogTotalCount - 1
          const totalPagesAfter = Math.max(1, Math.ceil(totalAfter / limit))
          const currentPage = catalogPage

          if (currentPage > totalPagesAfter && currentPage > 1) {
            const newPage = currentPage - 1
            setCatalogPage(newPage)
            loadMyCatalog(newPage, catalogSearch)
          } else {
            // Refill the current page from server if there are more items beyond
            if ((currentPage * limit) <= totalAfter) {
              loadMyCatalog(currentPage, catalogSearch)
            }
          }
        }, 0)
      } else {
        showNotification('error', 'Failed to remove song')
      }
    } catch (error) {
      logger.error('Error removing song:', error)
      showNotification('error', 'Failed to remove song')
    } finally {
      setIsRemovingSong(null)
    }
  }

  // Bulk remove selected songs
  const bulkRemoveSongs = async () => {
    const songIdsToRemove = Array.from(selectedCatalogSongs)
    
    if (songIdsToRemove.length === 0) {
      showNotification('info', 'No songs selected for removal')
      return
    }

    setIsBulkRemoving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/songcatalog/bulk-remove`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profileId,
          songIds: songIdsToRemove
        })
      })

      if (response.ok) {
        const result: BulkOperationResponse = await response.json()
        showNotification('success', `Removed ${result.successCount} songs from your catalog`)

        // Optimistically update UI immediately
        const selectedIdsSet = new Set(songIdsToRemove)
        setMyCatalog(prev => prev.filter(s => !selectedIdsSet.has(s.id)))
        setCatalogTotalCount(prev => Math.max(0, prev - result.successCount))
        setCatalogCount(prev => Math.max(0, prev - result.successCount))

        // Clear selections
        setSelectedCatalogSongs(new Set())

        // Adjust pagination: if page emptied and not first page, go back; else refill current page if there are more items
        setTimeout(() => {
          const totalAfter = Math.max(0, catalogTotalCount - result.successCount)
          const totalPagesAfter = Math.max(1, Math.ceil(totalAfter / limit))
          const currentPage = catalogPage

          if (currentPage > totalPagesAfter && currentPage > 1) {
            const newPage = currentPage - 1
            setCatalogPage(newPage)
            loadMyCatalog(newPage, catalogSearch)
          } else {
            if ((currentPage * limit) <= totalAfter) {
              loadMyCatalog(currentPage, catalogSearch)
            }
          }
        }, 0)
      } else {
        showNotification('error', 'Failed to remove songs')
      }
    } catch (error) {
      logger.error('Error bulk removing songs:', error)
      showNotification('error', 'Failed to remove songs')
    } finally {
      setIsBulkRemoving(false)
    }
  }

  // Parse uploaded file
  const parseFile = async (file: File): Promise<UploadSong[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const songs: UploadSong[] = []
          
          // Determine file type
          const isCSV = file.name.toLowerCase().endsWith('.csv')
          
          if (isCSV) {
            // Parse CSV
            const lines = content.split('\n').filter(line => line.trim())
            if (lines.length === 0) {
              reject(new Error('File is empty'))
              return
            }
            
            // Skip header row
            const dataLines = lines.slice(1)
            
            for (const line of dataLines) {
              const columns = line.split(',').map(col => col.trim())
              if (columns.length >= 2) {
                songs.push({
                  title: columns[0] || '',
                  artist: columns[1] || '',
                  album: columns[2] || undefined,
                  genre: columns[3] || undefined
                })
              }
            }
          } else {
            // Parse text file - try different delimiters
            const lines = content.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              let columns: string[] = []
              
              // Try comma first
              if (line.includes(',')) {
                columns = line.split(',').map(col => col.trim())
              }
              // Try pipe
              else if (line.includes('|')) {
                columns = line.split('|').map(col => col.trim())
              }
              // Try tab
              else if (line.includes('\t')) {
                columns = line.split('\t').map(col => col.trim())
              }
              // Single item per line (title only - invalid)
              else {
                columns = [line.trim()]
              }
              
              if (columns.length >= 2) {
                songs.push({
                  title: columns[0] || '',
                  artist: columns[1] || '',
                  album: columns[2] || undefined,
                  genre: columns[3] || undefined
                })
              }
            }
          }
          
          resolve(songs)
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      showNotification('error', 'File size exceeds 5MB limit')
      return
    }
    
    // Check file type
    const validExtensions = ['.csv', '.txt']
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!validExtensions.includes(fileExtension)) {
      showNotification('error', 'Only CSV and TXT files are supported')
      return
    }
    
    setUploadedFile(file)
    
    try {
      const songs = await parseFile(file)
      if (songs.length === 0) {
        showNotification('error', 'No valid songs found in file')
        return
      }
      
      setParsedSongs(songs)
      setShowPreviewModal(true)
    } catch (error) {
      logger.error('Error parsing file:', error)
      showNotification('error', 'Failed to parse file')
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Confirm upload
  const confirmUpload = async () => {
    setShowPreviewModal(false)
    setIsUploading(true)
    
    try {
      const token = localStorage.getItem('token')
      
      logger.log('Starting upload...', {
        songCount: parsedSongs.length,
        endpoint: `${API_BASE_URL}/api/songcatalog/bulk-upload`
      })
      
      const response = await fetch(`${API_BASE_URL}/api/songcatalog/bulk-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          songs: parsedSongs.map(song => ({
            Title: song.title,
            Artist: song.artist,
            Album: song.album || null,
            Genre: song.genre || null
          }))
        })
      })

      logger.log('Upload response status:', response.status)
      
      if (response.ok) {
        const result: BulkUploadResponse = await response.json()
        logger.log('Upload result:', result)
        setUploadSummary(result)
        setShowSummaryModal(true)
        
        // Reset upload state
        setUploadedFile(null)
        setParsedSongs([])
        
        // Refresh catalog
        refreshCatalogCount()
        if (activeView === 'catalog') {
          loadMyCatalog()
        }
      } else {
        const errorText = await response.text()
        logger.error('Upload failed:', response.status, errorText)
        showNotification('error', `Failed to upload songs: ${errorText}`)
      }
    } catch (error) {
      logger.error('Error uploading songs:', error)
      showNotification('error', `Failed to upload songs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsUploading(false)
    }
  }

  // Cancel upload
  const cancelUpload = () => {
    setShowPreviewModal(false)
    setUploadedFile(null)
    setParsedSongs([])
  }

  // Show notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  // Initialize
  useEffect(() => {
    if (activeView === 'catalog') {
      loadMyCatalog()
    } else {
      // If not on catalog view, at least get the count for the tab
      refreshCatalogCount()
    }
  }, [activeView, profileId])

  // Load catalog count on initial mount regardless of active view
  useEffect(() => {
    if (profileId) {
      refreshCatalogCount()
    }
  }, [profileId])

  const toggleCatalogSongSelection = (songId: string) => {
    setSelectedCatalogSongs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(songId)) {
        newSet.delete(songId)
      } else {
        newSet.add(songId)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          notification.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center">
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Song Request Management</h2>
        <p className="text-gray-600">Search for songs to add to your catalog or manage your existing song list.</p>
      </div>

      {/* View Toggle */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveView('search')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeView === 'search'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Search Songs
            </button>
            <button
              onClick={() => setActiveView('upload')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeView === 'upload'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload Songs
            </button>
            <button
              onClick={() => setActiveView('catalog')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeView === 'catalog'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Catalog ({catalogCount})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Search View */}
          {activeView === 'search' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  🎵 Search for high-quality music data. Only original albums and singles with no cover versions are shown.
                </p>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} className="flex flex-col space-y-3">
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Song Title *</label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g., Your Love Is King"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Artist (Optional)</label>
                    <input
                      type="text"
                      value={searchArtist}
                      onChange={(e) => setSearchArtist(e.target.value)}
                      placeholder="e.g., Sade"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 w-full sm:w-auto"
                >
                  {isSearching ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Search</span>
                    </>
                  )}
                </button>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Found {searchResults.length} results</p>
                  <div className="grid gap-4">
                    {searchResults.map((song: any) => (
                      <div key={song.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{song.title}</h4>
                            <p className="text-gray-600 text-sm">by {song.artist}</p>
                            {song.album && (
                              <p className="text-sm text-gray-500">Album: {song.album}</p>
                            )}
                            {song.genre && (
                              <p className="text-sm text-gray-500">Genre: {song.genre}</p>
                            )}
                          </div>
                          <button
                            onClick={() => addSongToCatalog(song)}
                            disabled={isAddingSong === `${song.title}-${song.artist}`}
                            className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap text-sm"
                          >
                            {isAddingSong === `${song.title}-${song.artist}` ? 'Adding...' : 'Add'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No results message */}
              {searchQuery && searchResults.length === 0 && !isSearching && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No songs found</h3>
                  <p className="text-gray-500">Try searching with different keywords or artist names.</p>
                </div>
              )}
            </div>
          )}

          {/* Upload View */}
          {activeView === 'upload' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  📤 Upload a CSV or text file with your song list. Format: <strong>title, artist, album, genre</strong> (title and artist are required).
                  Text files can use comma, pipe (|), or tab delimiters.
                </p>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition ${
                  isDragging
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {isDragging ? 'Drop file here' : 'Drag and drop your file here'}
                </h3>
                <p className="text-gray-500 mb-4">or</p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <span className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer inline-block">
                    Select File
                  </span>
                </label>
                <p className="text-sm text-gray-500 mt-4">Supports CSV and TXT files (max 5MB)</p>
              </div>

              {/* File Info */}
              {uploadedFile && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-green-800 font-medium">{uploadedFile.name}</p>
                        <p className="text-sm text-green-600">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setUploadedFile(null)
                        setParsedSongs([])
                      }}
                      className="text-green-600 hover:text-green-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {/* Format Examples */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">File Format Examples</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">CSV Format</h4>
                    <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto">
{`title,artist,album,genre
Bohemian Rhapsody,Queen,A Night at the Opera,Rock
Hotel California,Eagles,Hotel California,Rock`}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Text Format (Comma/Pipe/Tab)</h4>
                    <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto">
{`Bohemian Rhapsody,Queen,A Night at the Opera,Rock
Hotel California|Eagles|Hotel California|Rock`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Catalog View */}
          {activeView === 'catalog' && (
            <div className="space-y-6">
              {/* Catalog Search */}
              <form onSubmit={handleCatalogSearch} className="flex space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search your catalog..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoadingCatalog}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  Filter
                </button>
              </form>

              {/* Bulk Actions for Catalog */}
              {selectedCatalogSongs.size > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-red-800 font-medium">
                      {selectedCatalogSongs.size} song(s) selected
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedCatalogSongs(new Set())}
                        className="px-3 py-1 text-red-600 hover:text-red-800 text-sm"
                      >
                        Clear Selection
                      </button>
                      <button
                        onClick={bulkRemoveSongs}
                        disabled={isBulkRemoving}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
                      >
                        {isBulkRemoving ? 'Removing...' : 'Remove Selected'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* My Catalog */}
              {myCatalog.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {myCatalog.map((song) => (
                      <div key={song.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedCatalogSongs.has(song.id)}
                              onChange={() => toggleCatalogSongSelection(song.id)}
                              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                            <div>
                              <h4 className="font-medium text-gray-900">{song.songTitle}</h4>
                              <p className="text-gray-600">by {song.artist}</p>
                              {song.album && (
                                <p className="text-sm text-gray-500">Album: {song.album}</p>
                              )}
                              {song.genre && (
                                <p className="text-sm text-gray-500">Genre: {song.genre}</p>
                              )}
                              <p className="text-xs text-gray-400">
                                Added: {new Date(song.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeSongFromCatalog(song.id)}
                            disabled={isRemovingSong === song.id}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
                          >
                            {isRemovingSong === song.id ? 'Removing...' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Catalog Pagination */}
                  {catalogTotalCount > limit && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {(catalogPage - 1) * limit + 1} to {Math.min(catalogPage * limit, catalogTotalCount)} of {catalogTotalCount} songs
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            const newPage = catalogPage - 1
                            setCatalogPage(newPage)
                            loadMyCatalog(newPage, catalogSearch)
                          }}
                          disabled={catalogPage <= 1 || isLoadingCatalog}
                          className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => {
                            const newPage = catalogPage + 1
                            setCatalogPage(newPage)
                            loadMyCatalog(newPage, catalogSearch)
                          }}
                          disabled={catalogPage * limit >= catalogTotalCount || isLoadingCatalog}
                          className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No songs in your catalog</h3>
                  <p className="text-gray-500 mb-4">Start building your song catalog by searching and adding songs.</p>
                  <button
                    onClick={() => setActiveView('search')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Search Songs
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={cancelUpload}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Preview Upload - {parsedSongs.length} Songs
                    </h3>
                    <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artist</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Album</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Genre</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {parsedSongs.map((song, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{song.title}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{song.artist}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{song.album || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{song.genre || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={confirmUpload}
                  disabled={isUploading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Confirm Upload'}
                </button>
                <button
                  type="button"
                  onClick={cancelUpload}
                  disabled={isUploading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && uploadSummary && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowSummaryModal(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Upload Complete
                    </h3>
                    
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{uploadSummary.addedCount}</div>
                        <div className="text-sm text-green-800">Added</div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-yellow-600">{uploadSummary.duplicateCount}</div>
                        <div className="text-sm text-yellow-800">Duplicates</div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">{uploadSummary.failedCount}</div>
                        <div className="text-sm text-red-800">Failed</div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="max-h-96 overflow-y-auto space-y-4">
                      {/* Added Songs */}
                      {uploadSummary.addedSongs.length > 0 && (
                        <div>
                          <h4 className="font-medium text-green-800 mb-2">✓ Successfully Added ({uploadSummary.addedCount})</h4>
                          <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1 max-h-40 overflow-y-auto">
                            {uploadSummary.addedSongs.map((song, idx) => (
                              <div key={idx} className="text-sm text-green-900">
                                {song.title} - {song.artist}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Duplicate Songs */}
                      {uploadSummary.duplicateSongs.length > 0 && (
                        <div>
                          <h4 className="font-medium text-yellow-800 mb-2">⚠ Skipped Duplicates ({uploadSummary.duplicateCount})</h4>
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 space-y-1 max-h-40 overflow-y-auto">
                            {uploadSummary.duplicateSongs.map((song, idx) => (
                              <div key={idx} className="text-sm text-yellow-900">
                                {song.title} - {song.artist}
                                {song.reason && <span className="text-yellow-700 ml-2">({song.reason})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Failed Songs */}
                      {uploadSummary.failedSongs.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-800 mb-2">✗ Failed ({uploadSummary.failedCount})</h4>
                          <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1 max-h-40 overflow-y-auto">
                            {uploadSummary.failedSongs.map((song, idx) => (
                              <div key={idx} className="text-sm text-red-900">
                                {song.title} - {song.artist}
                                {song.reason && <span className="text-red-700 ml-2">({song.reason})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowSummaryModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SongManagement 