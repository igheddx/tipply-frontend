import logger from "../utils/logger";
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE_URL } from '../utils/config'
import { BrandIcon } from './icons/BrandIcons'
import { StatusChip } from './ui'

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

type RequestStatus = SongRequest['status']

interface MonitorDevice {
  id: string
  nickname?: string
  isPaused?: boolean
}

interface SongRequestMonitorProps {
  profileId: string
  isVisible: boolean
  onClose: () => void
  // Song-request-enabled devices, so the performer can pause/resume them from this screen
  devices?: MonitorDevice[]
  pausingDeviceId?: string | null
  onTogglePause?: (deviceId: string) => void
}

const REFRESH_MS = 5000
const requestKey = (r: SongRequest) => r.requestIds.join('-')

// Three reading sizes, for a tablet on a stand a few feet away
const SIZES = [
  { title: 'text-xl', now: 'text-3xl md:text-4xl', artist: 'text-base', chip: 'text-sm' },
  { title: 'text-2xl', now: 'text-4xl md:text-5xl', artist: 'text-lg', chip: 'text-base' },
  { title: 'text-3xl', now: 'text-5xl md:text-6xl', artist: 'text-xl', chip: 'text-lg' }
]

const ago = (iso: string, now: number) => {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  return `${h}h ${mins % 60}m ago`
}

const readPref = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const writePref = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* preference just won't persist */
  }
}

const SongRequestMonitor: React.FC<SongRequestMonitorProps> = ({
  profileId,
  isVisible,
  onClose,
  devices = [],
  pausingDeviceId = null,
  onTogglePause
}) => {
  const [songRequests, setSongRequests] = useState<SongRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [sizeIdx, setSizeIdx] = useState(() => Math.min(2, Math.max(0, Number(readPref('monitor_size', '1')) || 1)))
  const [chime, setChime] = useState(() => readPref('monitor_chime', 'off') === 'on')
  const [showDone, setShowDone] = useState(false)
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set())
  const [pauseDeviceId, setPauseDeviceId] = useState('')
  const knownKeys = useRef<Set<string> | null>(null)
  const chimeRef = useRef<HTMLAudioElement | null>(null)
  const wakeLockRef = useRef<any>(null)
  const pauseInitRef = useRef(false)

  const size = SIZES[sizeIdx]

  // One device: always selected. Several: the performer picks one first, unless some are paused.
  const selectedPauseDevice = devices.length === 1 ? devices[0] : devices.find(d => d.id === pauseDeviceId)
  const pausedCount = devices.filter(d => d.isPaused).length

  // When the monitor opens with a paused device, preselect it so it can be resumed right away
  useEffect(() => {
    if (!isVisible) {
      pauseInitRef.current = false
      setPauseDeviceId('')
      return
    }
    if (pauseInitRef.current) return
    pauseInitRef.current = true
    const paused = devices.filter(d => d.isPaused)
    if (devices.length > 1 && paused.length > 0) {
      setPauseDeviceId(paused[Math.floor(Math.random() * paused.length)].id)
    }
  }, [isVisible, devices])

  const loadSongRequests = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/SongCatalog/monitor/${profileId}?_t=${Date.now()}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        const list: SongRequest[] = data.songRequests || []
        setSongRequests(list)
        setLoadFailed(false)

        // Highlight (and optionally chime for) requests that were not there on the previous refresh
        const keys = new Set(list.filter(r => r.status === 'pending').map(requestKey))
        if (knownKeys.current) {
          const added = [...keys].filter(k => !knownKeys.current!.has(k))
          if (added.length > 0) {
            setFreshKeys(prev => new Set([...prev, ...added]))
            window.setTimeout(() => setFreshKeys(prev => new Set([...prev].filter(k => !added.includes(k)))), 6000)
            if (chimeRef.current && readPref('monitor_chime', 'off') === 'on') {
              chimeRef.current.currentTime = 0
              chimeRef.current.play().catch(() => undefined)
            }
          }
        }
        knownKeys.current = keys
      } else {
        setLoadFailed(true)
        logger.error(`[Monitor] Failed to load song requests: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setLoadFailed(true)
      logger.error('[Monitor] Error loading song requests:', error)
    } finally {
      setLoading(false)
    }
  }, [profileId])

  // Live updates while open, plus a clock for the "x min ago" labels
  useEffect(() => {
    if (!isVisible) {
      knownKeys.current = null
      return
    }
    loadSongRequests()
    const refresh = window.setInterval(loadSongRequests, REFRESH_MS)
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    return () => {
      window.clearInterval(refresh)
      window.clearInterval(tick)
    }
  }, [isVisible, loadSongRequests])

  // Stop the tablet from dimming or locking while the monitor is up on stage
  useEffect(() => {
    if (!isVisible) return
    let cancelled = false
    const acquire = async () => {
      try {
        const lock = await (navigator as any).wakeLock?.request('screen')
        if (cancelled) {
          lock?.release()
        } else {
          wakeLockRef.current = lock
        }
      } catch {
        /* not supported or denied: the screen may dim, nothing else breaks */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      wakeLockRef.current?.release?.()
      wakeLockRef.current = null
    }
  }, [isVisible])

  // Prevent the page behind from scrolling
  useEffect(() => {
    if (!isVisible) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isVisible])

  const updateSongStatus = async (request: SongRequest, newStatus: RequestStatus) => {
    const key = requestKey(request)
    setUpdatingStatus(key)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/SongCatalog/monitor/update-status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          songId: request.songId,
          requestIds: request.requestIds,
          status: newStatus
        })
      })

      if (response.ok) {
        // Update immediately so the screen feels instant, then confirm with the server
        setSongRequests(prev => prev.map(r => (requestKey(r) === key ? { ...r, status: newStatus } : r)))
        window.setTimeout(loadSongRequests, 1000)
      } else {
        logger.error('Failed to update status:', response.status, await response.text())
      }
    } catch (error) {
      logger.error('Error updating song status:', error)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const changeSize = (delta: number) => {
    const next = Math.min(2, Math.max(0, sizeIdx + delta))
    setSizeIdx(next)
    writePref('monitor_size', String(next))
  }

  const toggleChime = () => {
    const next = !chime
    setChime(next)
    writePref('monitor_chime', next ? 'on' : 'off')
    // Playing once on enabling both previews the sound and satisfies the browser's autoplay rule
    if (next && chimeRef.current) {
      chimeRef.current.currentTime = 0
      chimeRef.current.play().catch(() => undefined)
    }
  }

  if (!isVisible) return null

  // Playing first, then waiting by tip (highest first) and age, then everything finished
  const byTipThenAge = (a: SongRequest, b: SongRequest) =>
    b.totalTipAmount - a.totalTipAmount || new Date(a.firstRequestTime).getTime() - new Date(b.firstRequestTime).getTime()
  const performing = songRequests.filter(r => r.status === 'performing').sort(byTipThenAge)
  const pending = songRequests.filter(r => r.status === 'pending').sort(byTipThenAge)
  const done = songRequests
    .filter(r => r.status === 'completed' || r.status === 'skipped' || r.status === 'cancelled')
    .sort((a, b) => new Date(b.lastRequestTime).getTime() - new Date(a.lastRequestTime).getTime())

  const btn =
    'inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-lg font-bold transition-colors active:scale-[0.98] disabled:opacity-50'

  const Note = ({ r }: { r: SongRequest }) =>
    r.requestorName || r.note ? (
      <div className="mt-3 rounded-xl bg-white/5 px-4 py-3 text-white/80">
        {r.requestorName && (
          <div className="flex items-center gap-2 font-semibold">
            <BrandIcon name="user" size={16} color="#7EE3EF" />
            {r.requestorName}
          </div>
        )}
        {r.note && <div className={`${r.requestorName ? 'mt-1' : ''} leading-snug`}>{r.note}</div>}
      </div>
    ) : null

  const TipBadge = ({ r }: { r: SongRequest }) => (
    <span className={`inline-flex items-center rounded-full bg-accent-500 px-3 py-1 font-bold text-white ${size.chip}`}>
      ${r.totalTipAmount.toFixed(2)}
      {r.requestCount > 1 && <span className="ml-2 font-semibold text-white/85">· {r.requestCount} requests</span>}
    </span>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col text-white"
      style={{
        background: 'linear-gradient(160deg,#0a2533,#0d4254 60%,#0f3447)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
      role="dialog"
      aria-label="Live song requests"
    >
      <audio ref={chimeRef} src="/cash-register.mp3" preload="auto" />

      {/* Top bar: kept slim so the queue gets the screen, and usable in a narrow side window */}
      <header className="flex flex-none flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-white/10 pl-2 pr-4 font-semibold hover:bg-white/15"
          aria-label="Close live requests"
        >
          <BrandIcon name="chevron-left" size={20} color="#FFFFFF" />
          Close
        </button>

        <div className="mr-auto flex items-center gap-2">
          <h1 className="text-lg font-bold">Live requests</h1>
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${loadFailed ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/80'}`}
            role="status"
          >
            <span className={`h-2 w-2 rounded-full ${loadFailed ? 'bg-amber-300' : 'animate-pulse bg-emerald-400'}`} />
            {loadFailed ? 'Reconnecting…' : loading && songRequests.length === 0 ? 'Loading…' : 'Live'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onTogglePause && devices.length > 0 && (
            <div className="flex items-center gap-2">
              {devices.length > 1 && (
                <select
                  value={selectedPauseDevice?.id ?? ''}
                  onChange={e => setPauseDeviceId(e.target.value)}
                  className="h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white"
                  aria-label="Choose a device to pause"
                >
                  <option value="" className="text-ink-900">Choose device</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id} className="text-ink-900">
                      {d.nickname || 'Device'}
                      {d.isPaused ? ' (paused)' : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedPauseDevice && (
                <button
                  onClick={() => onTogglePause(selectedPauseDevice.id)}
                  disabled={pausingDeviceId === selectedPauseDevice.id}
                  title={selectedPauseDevice.isPaused ? 'Turn the light and sound back on' : 'Stops light and sound. Tips still go through.'}
                  className={`flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${
                    selectedPauseDevice.isPaused ? 'bg-amber-400 text-ink-900' : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  <BrandIcon name={selectedPauseDevice.isPaused ? 'play' : 'pause'} size={18} color={selectedPauseDevice.isPaused ? '#1B2530' : '#FFFFFF'} />
                  {selectedPauseDevice.isPaused ? 'Resume device' : devices.length === 1 ? `Pause ${devices[0].nickname || 'device'}` : 'Pause device'}
                </button>
              )}
              {pausedCount > 1 && <span className="text-sm font-semibold text-amber-300">Several devices paused</span>}
            </div>
          )}

          <div className="flex items-center rounded-xl bg-white/10" role="group" aria-label="Text size">
            <button onClick={() => changeSize(-1)} disabled={sizeIdx === 0} className="h-11 w-11 text-lg font-bold disabled:opacity-30" aria-label="Smaller text">
              A−
            </button>
            <button onClick={() => changeSize(1)} disabled={sizeIdx === 2} className="h-11 w-11 text-xl font-bold disabled:opacity-30" aria-label="Larger text">
              A+
            </button>
          </div>

          <button
            onClick={toggleChime}
            aria-pressed={chime}
            aria-label="Play a sound for new requests"
            title="Play a sound for new requests"
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${chime ? 'bg-brand-500' : 'bg-white/10'}`}
          >
            <BrandIcon name="volume" size={22} color="#FFFFFF" />
          </button>
        </div>
      </header>

      {/* Queue */}
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1.1fr_1fr]">
          {/* Playing now */}
          <section aria-label="Playing now">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-200">Playing now</h2>
            {performing.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/20 p-8 text-center text-white/70">
                <p className="text-lg font-semibold text-white">Nothing playing</p>
                <p className="mt-1">Tap “Play this” on a request when you start it.</p>
              </div>
            ) : (
              performing.map(r => {
                const key = requestKey(r)
                return (
                  <article key={key} className="mb-4 rounded-3xl bg-white p-6 text-ink-900 shadow-lift">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip kind="active" label="Playing" />
                      <TipBadge r={r} />
                    </div>
                    <h3 className={`mt-4 font-extrabold leading-tight ${size.now}`}>{r.songTitle}</h3>
                    <p className={`mt-1 text-ink-500 ${size.artist}`}>{r.artist}</p>
                    {(r.requestorName || r.note) && (
                      <div className="mt-4 rounded-xl bg-surface px-4 py-3 text-ink-700">
                        {r.requestorName && <div className="font-semibold">From {r.requestorName}</div>}
                        {r.note && <div className="mt-0.5">{r.note}</div>}
                      </div>
                    )}
                    <button
                      onClick={() => updateSongStatus(r, 'completed')}
                      disabled={updatingStatus === key}
                      className={`${btn} mt-5 w-full bg-brand-700 text-white hover:bg-brand-800`}
                    >
                      <BrandIcon name="check" size={22} color="#FFFFFF" strokeWidth={2.4} />
                      {updatingStatus === key ? 'Saving…' : 'Done playing'}
                    </button>
                  </article>
                )
              })
            )}
          </section>

          {/* Up next */}
          <section aria-label="Up next">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-200">
              Up next
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs text-white">{pending.length}</span>
            </h2>

            {pending.length === 0 ? (
              <div className="rounded-3xl bg-white/5 p-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                  <BrandIcon name="music" size={28} color="#7EE3EF" />
                </span>
                <p className="mt-4 text-lg font-semibold">No requests waiting</p>
                <p className="mt-1 text-white/70">New requests appear here the moment someone tips.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {pending.map((r, i) => {
                  const key = requestKey(r)
                  const fresh = freshKeys.has(key)
                  return (
                    <li
                      key={key}
                      className={`rounded-3xl p-5 transition-colors ${fresh ? 'bg-accent-500/25 ring-2 ring-accent-400' : 'bg-white/10'}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <TipBadge r={r} />
                            {fresh && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-accent-700">NEW</span>}
                            <span className="text-sm text-white/60">{ago(r.firstRequestTime, now)}</span>
                          </div>
                          <h3 className={`mt-2 font-bold leading-tight ${size.title}`}>{r.songTitle}</h3>
                          <p className={`text-white/70 ${size.artist}`}>{r.artist}</p>
                          <Note r={r} />
                        </div>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => updateSongStatus(r, 'performing')}
                          disabled={updatingStatus === key}
                          className={`${btn} flex-1 bg-white text-ink-900 hover:bg-brand-50`}
                        >
                          <BrandIcon name="play" size={22} color="#0E7490" />
                          {updatingStatus === key ? 'Saving…' : 'Play this'}
                        </button>
                        <button
                          onClick={() => updateSongStatus(r, 'skipped')}
                          disabled={updatingStatus === key}
                          className={`${btn} bg-white/10 px-5 text-white hover:bg-white/15`}
                          aria-label={`Skip ${r.songTitle}`}
                        >
                          Skip
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Finished requests stay out of the way until asked for */}
            {done.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowDone(s => !s)}
                  aria-expanded={showDone}
                  className="flex h-11 items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
                >
                  <BrandIcon name={showDone ? 'chevron-down' : 'chevron-right'} size={18} color="currentColor" />
                  {showDone ? 'Hide' : 'Show'} finished ({done.length})
                </button>
                {showDone && (
                  <ul className="mt-2 space-y-2">
                    {done.map(r => (
                      <li key={requestKey(r)} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{r.songTitle}</div>
                          <div className="truncate text-sm text-white/60">{r.artist}</div>
                        </div>
                        <StatusChip
                          kind={r.status === 'completed' ? 'paid' : 'offline'}
                          label={r.status === 'completed' ? 'Played' : r.status === 'skipped' ? 'Skipped' : 'Cancelled'}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default SongRequestMonitor
