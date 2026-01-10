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

interface ExternalSong {
  songTitle: string
  artist: string
  album: string
  genre: string
  isInCatalog: boolean
}

interface SearchResponse {
  songs: ExternalSong[]
  totalCount: number
  page: number
  limit: number
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

interface SongManagementProps {
  profileId: string
}

const SongManagement: React.FC<SongManagementProps> = ({ profileId }) => {
  // State management
  const [activeView, setActiveView] = useState<'search' | 'catalog'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [myCatalog, setMyCatalog] = useState<Song[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCount, setCatalogCount] = useState<number>(0)
  
  // Loading states
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [isAddingSong, setIsAddingSong] = useState<string | null>(null)
  const [isRemovingSong, setIsRemovingSong] = useState<string | null>(null)
  // Bulk operations
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set())
  const [selectedCatalogSongs, setSelectedCatalogSongs] = useState<Set<string>>(new Set())
  const [isBulkAdding, setIsBulkAdding] = useState(false)
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
          const fullResponse = await fetch(`${API_BASE_URL}/api/songcatalog/my-songs/${profileId}`, {
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
      console.error('Error refreshing catalog count:', error)
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
            const fullResponse = await fetch(`${API_BASE_URL}/api/songcatalog/my-songs/${profileId}`, {
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
            console.error('Error fetching full catalog for count:', err)
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
      console.error('Error loading catalog:', error)
      showNotification('error', 'Failed to load your song catalog')
    } finally {
      setIsLoadingCatalog(false)
    }
  }

  // Search external songs
  const searchSongs = async (query: string, page = 1) => {
    if (!query.trim()) return
    
    setIsSearching(true)
    // Clear previous results when starting a new search (page 1)
    if (page === 1) {
      setSearchResults([])
      setSearchTotalCount(0)
      setSelectedSongs(new Set()) // Clear any previous selections
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/songcatalog/musicbrainz/search?query=${encodeURIComponent(query.trim())}&limit=20`)
      
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
        setSearchTotalCount(data.length)
        setSearchPage(1)
      } else {
        showNotification('error', 'Failed to search songs')
      }
    } catch (error) {
      console.error('Error searching songs:', error)
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
      console.error('Error adding song:', error)
      showNotification('error', 'Failed to add song to catalog')
    } finally {
      setIsAddingSong(null)
    }
  }

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      searchSongs(searchQuery)
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
        loadMyCatalog(1, catalogSearch)
      } else {
        showNotification('error', 'Failed to remove song')
      }
    } catch (error) {
      console.error('Error removing song:', error)
      showNotification('error', 'Failed to remove song')
    } finally {
      setIsRemovingSong(null)
    }
  }
        // Clear selections and refresh
        setSelectedSongs(new Set())
        searchSongs(searchQuery, searchPage)
        // Refresh catalog count
        refreshCatalogCount()
      } else {
        showNotification('error', 'Failed to add songs')
      }
    } catch (error) {
      console.error('Error bulk adding songs:', error)
      showNotification('error', 'Failed to add songs')
    } finally {
      setIsBulkAdding(false)
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
        
        // Clear selections and refresh
        setSelectedCatalogSongs(new Set())
        loadMyCatalog(catalogPage, catalogSearch)
      } else {
        showNotification('error', 'Failed to remove songs')
      }
    } catch (error) {
      console.error('Error bulk removing songs:', error)
      showNotification('error', 'Failed to remove songs')
    } finally {
      setIsBulkRemoving(false)
    }
  }

  // Show notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSearchPage(1)
      searchSongs(searchQuery, 1)
    }
  }

  // Handle catalog search
  const handleCatalogSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCatalogPage(1)
    loadMyCatalog(1, catalogSearch)
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

  // Toggle song selection for bulk operations
  const toggleSongSelection = (songKey: string) => {
    setSelectedSongs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(songKey)) {
        newSet.delete(songKey)
      } else {
        newSet.add(songKey)
      }
      return newSet
    })
  }

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
                  🎵 Search the free MusicBrainz catalog for high-quality music data. Only original albums and singles with no cover versions are shown.
                </p>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} className="flex space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for songs, artists, or albums..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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

              {/* Bulk Actions for Search Results */}
              {selectedSongs.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-800 font-medium">
                      {selectedSongs.size} song(s) selected
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedSongs(new Set())}
                        className="px-3 py-1 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Clear Selection
                      </button>
                      <button
                        onClick={bulkAddSongs}
                        disabled={isBulkAdding}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                      >
                        {isBulkAdding ? 'Adding...' : 'Add Selected'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
    </div>
  )
}

export default SongManagement 