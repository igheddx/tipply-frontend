import logger from "../utils/logger";
import { Banner, Button, Card, EmptyState, Modal, StatCard, Tabs, Toast } from './ui'
import { BrandIcon, IconTile } from './icons/BrandIcons'
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

  const inputClass =
    'w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-ink-900 placeholder:text-ink-400 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500'
  const meta = (song: { album?: string; genre?: string }) => [song.album, song.genre].filter(Boolean).join(' · ')

  return (
    <div className="space-y-5">
      {notification && (
        <Toast tone={notification.type} message={notification.message} onDismiss={() => setNotification(null)} />
      )}

      <Tabs
        active={activeView}
        onChange={id => setActiveView(id as typeof activeView)}
        items={[
          { id: 'search', label: 'Find songs' },
          { id: 'upload', label: 'Upload a list' },
          { id: 'catalog', label: 'My catalog', count: catalogCount }
        ]}
      />

      {/* Find songs */}
      {activeView === 'search' && (
        <div className="space-y-5">
          <Banner tone="info" title="Search for a song to add">
            Results are original albums and singles only, with no cover versions.
          </Banner>

          <Card>
            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="song-title" className="mb-1.5 block text-sm font-semibold text-ink-700">Song title</label>
                  <input
                    id="song-title"
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Your Love Is King"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="song-artist" className="mb-1.5 block text-sm font-semibold text-ink-700">
                    Artist <span className="font-normal text-ink-500">(optional)</span>
                  </label>
                  <input
                    id="song-artist"
                    type="text"
                    value={searchArtist}
                    onChange={e => setSearchArtist(e.target.value)}
                    placeholder="Sade"
                    className={inputClass}
                  />
                </div>
              </div>
              <Button type="submit" icon="search" loading={isSearching} disabled={!searchQuery.trim()}>
                Search
              </Button>
            </form>
          </Card>

          {searchResults.length > 0 && (
            <Card title={`${searchResults.length} ${searchResults.length === 1 ? 'result' : 'results'}`} flush>
              <ul className="divide-y divide-slate-100 px-5 pb-2">
                {searchResults.map((song: any) => {
                  const adding = isAddingSong === `${song.title}-${song.artist}`
                  return (
                    <li key={song.id} className="flex items-center gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink-900">{song.title}</div>
                        <div className="truncate text-sm text-ink-500">{[song.artist, meta(song)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <Button variant="secondary" size="sm" icon="plus" loading={adding} onClick={() => addSongToCatalog(song)}>
                        Add
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <Card>
              <EmptyState icon="search" title="No songs found">
                Try different keywords, or search by artist.
              </EmptyState>
            </Card>
          )}
        </div>
      )}

      {/* Upload a list */}
      {activeView === 'upload' && (
        <div className="space-y-5">
          <Banner tone="info" title="Add many songs at once">
            Upload a CSV or text file with <strong>title, artist, album, genre</strong>. Title and artist are required. Text files can use commas, pipes (|) or tabs.
          </Banner>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              isDragging ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-white'
            }`}
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
              <span className="rotate-180"><BrandIcon name="download" size={26} /></span>
            </span>
            <h3 className="mt-4 text-lg font-bold text-ink-900">{isDragging ? 'Drop the file here' : 'Drag a file here'}</h3>
            <p className="mt-1 text-sm text-ink-500">or choose one from your device. CSV or TXT, up to 5 MB.</p>
            <label className="mt-5 inline-block">
              <input type="file" accept=".csv,.txt" onChange={handleFileInputChange} className="sr-only" />
              <span className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-ink-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-brand-500">
                Choose file
              </span>
            </label>
          </div>

          {uploadedFile && (
            <Card>
              <div className="flex items-center gap-3">
                <IconTile name="check" state="done" size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink-900">{uploadedFile.name}</div>
                  <div className="text-sm text-ink-500">{(uploadedFile.size / 1024).toFixed(1)} KB</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUploadedFile(null)
                    setParsedSongs([])
                  }}
                >
                  Remove
                </Button>
              </div>
            </Card>
          )}

          <Card title="What the file should look like">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-ink-700">CSV</h4>
                <pre className="overflow-x-auto rounded-xl bg-surface p-3 text-xs text-ink-700">{`title,artist,album,genre
Bohemian Rhapsody,Queen,A Night at the Opera,Rock
Hotel California,Eagles,Hotel California,Rock`}</pre>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-ink-700">Text (commas, pipes or tabs)</h4>
                <pre className="overflow-x-auto rounded-xl bg-surface p-3 text-xs text-ink-700">{`Bohemian Rhapsody,Queen,A Night at the Opera,Rock
Hotel California|Eagles|Hotel California|Rock`}</pre>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* My catalog */}
      {activeView === 'catalog' && (
        <div className="space-y-5">
          <form onSubmit={handleCatalogSearch} className="flex gap-3">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <BrandIcon name="search" size={20} tone="muted" />
              </span>
              <input
                type="text"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Search your catalog"
                aria-label="Search your catalog"
                className={`${inputClass} pl-11`}
              />
            </div>
            <Button type="submit" variant="secondary" size="lg" loading={isLoadingCatalog}>
              Search
            </Button>
          </form>

          {selectedCatalogSongs.size > 0 && (
            <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-lift lg:top-3">
              <span className="mr-auto font-semibold">{selectedCatalogSongs.size} selected</span>
              <button onClick={() => setSelectedCatalogSongs(new Set())} className="h-9 rounded-lg px-3 text-sm font-semibold text-white/80 hover:bg-white/10">
                Clear
              </button>
              <button
                onClick={bulkRemoveSongs}
                disabled={isBulkRemoving}
                className="h-9 rounded-lg bg-red-500 px-4 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isBulkRemoving ? 'Removing…' : 'Remove selected'}
              </button>
            </div>
          )}

          {myCatalog.length > 0 ? (
            <Card flush>
              <ul className="divide-y divide-slate-100 px-5 pb-2">
                {myCatalog.map(song => (
                  <li key={song.id} className="flex items-center gap-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedCatalogSongs.has(song.id)}
                      onChange={() => toggleCatalogSongSelection(song.id)}
                      aria-label={`Select ${song.songTitle}`}
                      className="h-5 w-5 shrink-0 rounded border-slate-300 accent-brand-700"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-ink-900">{song.songTitle}</div>
                      <div className="truncate text-sm text-ink-500">{[song.artist, meta(song)].filter(Boolean).join(' · ')}</div>
                      <div className="text-xs text-ink-400">Added {new Date(song.createdAt).toLocaleDateString()}</div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      icon="trash"
                      loading={isRemovingSong === song.id}
                      onClick={() => removeSongFromCatalog(song.id)}
                      aria-label={`Remove ${song.songTitle}`}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>

              {catalogTotalCount > limit && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                  <div className="text-sm text-ink-500">
                    {(catalogPage - 1) * limit + 1} to {Math.min(catalogPage * limit, catalogTotalCount)} of {catalogTotalCount} songs
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="chevron-left"
                      disabled={catalogPage <= 1 || isLoadingCatalog}
                      onClick={() => {
                        const newPage = catalogPage - 1
                        setCatalogPage(newPage)
                        loadMyCatalog(newPage, catalogSearch)
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={catalogPage * limit >= catalogTotalCount || isLoadingCatalog}
                      onClick={() => {
                        const newPage = catalogPage + 1
                        setCatalogPage(newPage)
                        loadMyCatalog(newPage, catalogSearch)
                      }}
                    >
                      Next
                      <BrandIcon name="chevron-right" size={16} tone="brand" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon="music"
                title="No songs in your catalog yet"
                action={<Button onClick={() => setActiveView('search')} icon="search">Find songs</Button>}
              >
                Search for songs or upload a list. Fans can only request songs that are here.
              </EmptyState>
            </Card>
          )}
        </div>
      )}

      {/* Upload preview */}
      <Modal
        open={showPreviewModal}
        wide
        onClose={cancelUpload}
        title={`Preview: ${parsedSongs.length} ${parsedSongs.length === 1 ? 'song' : 'songs'}`}
        footer={
          <>
            <Button variant="secondary" onClick={cancelUpload} disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={confirmUpload} loading={isUploading}>
              Add {parsedSongs.length} {parsedSongs.length === 1 ? 'song' : 'songs'}
            </Button>
          </>
        }
      >
        <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="sticky top-0 bg-surface">
              <tr>
                {['Title', 'Artist', 'Album', 'Genre'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {parsedSongs.map((song, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 text-sm font-semibold text-ink-900">{song.title}</td>
                  <td className="px-4 py-3 text-sm text-ink-700">{song.artist}</td>
                  <td className="px-4 py-3 text-sm text-ink-500">{song.album || '—'}</td>
                  <td className="px-4 py-3 text-sm text-ink-500">{song.genre || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Upload result */}
      <Modal
        open={showSummaryModal && !!uploadSummary}
        wide
        onClose={() => setShowSummaryModal(false)}
        title="Upload complete"
        footer={<Button onClick={() => setShowSummaryModal(false)}>Done</Button>}
      >
        {uploadSummary && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatCard variant="inline" icon="check-circle" label="Added" value={uploadSummary.addedCount} />
              <StatCard variant="inline" icon="warning" label="Duplicates" value={uploadSummary.duplicateCount} />
              <StatCard variant="inline" icon="error" label="Failed" value={uploadSummary.failedCount} />
            </div>

            {uploadSummary.addedSongs.length > 0 && (
              <Banner tone="success" title={`Added (${uploadSummary.addedCount})`}>
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                  {uploadSummary.addedSongs.map((song, idx) => (
                    <li key={idx}>{song.title} · {song.artist}</li>
                  ))}
                </ul>
              </Banner>
            )}
            {uploadSummary.duplicateSongs.length > 0 && (
              <Banner tone="warning" title={`Already in your catalog (${uploadSummary.duplicateCount})`}>
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                  {uploadSummary.duplicateSongs.map((song, idx) => (
                    <li key={idx}>
                      {song.title} · {song.artist}
                      {song.reason && <span className="text-ink-500"> ({song.reason})</span>}
                    </li>
                  ))}
                </ul>
              </Banner>
            )}
            {uploadSummary.failedSongs.length > 0 && (
              <Banner tone="error" title={`Could not add (${uploadSummary.failedCount})`}>
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                  {uploadSummary.failedSongs.map((song, idx) => (
                    <li key={idx}>
                      {song.title} · {song.artist}
                      {song.reason && <span className="text-ink-500"> ({song.reason})</span>}
                    </li>
                  ))}
                </ul>
              </Banner>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SongManagement
