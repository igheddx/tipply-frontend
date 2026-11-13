import logger from "../utils/logger";
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE_URL } from '../utils/config'
import { BrandIcon } from './icons/BrandIcons'
import { StatusChip } from './ui'
import { usePortalTheme, useTheme } from '../theme/ThemeContext'
import { playTipChime, unlockTipChime, isTipChimeReady } from '../utils/tipChime'
import { SessionBanner } from './venue/SessionBanner'
import { RefundRequestDialog, type RefundableTip } from './refunds/RefundRequestDialog'
import { useShowList } from '../hooks/useShowList'
import { showTitle } from '../utils/showName'

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
  // Set while this song was played recently (the server clears it after 90 minutes)
  playedMinutesAgo?: number | null
  // Made from an admin's test tip: no money, shown marked TEST, never counted
  isTest?: boolean
  // The individual tips behind this request, so a refund can be asked for one of them
  items?: RequestItem[]
}

interface RequestItem {
  requestId: string
  tipId?: string | null
  amount: number
  createdAt: string
  refundRequest?: 'pending' | 'declined' | null
}

// A tip of an amount the performer chose to see even though the tipper picked no song
interface PlainTip {
  id: string
  amount: number
  createdAt: string
  status?: string
  // pending or declined when a refund was asked for this tip
  refundRequest?: 'pending' | 'declined' | null
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
  /**
   * An admin watching a performer's Live screen (Admin → Insights). Shows exactly what the performer sees, but has no buttons that
   * change anything: no play, skip, played, seen, refund or pause. Sound and the "new" glow are local to the watcher's own browser.
   */
  readOnly?: boolean
  /** Shown in a strip across the top while watching, e.g. "Watching Dave Lovett" */
  watchingLabel?: string
}

const REFRESH_MS = 5000
const requestKey = (r: SongRequest) => r.requestIds.join('-')
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const SEEN_TIPS_KEY = 'monitor_seen_tips'
const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// Three reading sizes, for a tablet on a stand a few feet away
const SIZES = [
  { title: 'text-xl', now: 'text-3xl md:text-4xl', artist: 'text-base', chip: 'text-sm' },
  { title: 'text-2xl', now: 'text-4xl md:text-5xl', artist: 'text-lg', chip: 'text-base' },
  { title: 'text-3xl', now: 'text-5xl md:text-6xl', artist: 'text-xl', chip: 'text-lg' }
]

const playedAgo = (mins: number) => (mins < 1 ? 'Played just now' : mins < 60 ? `Played ${mins} min ago` : `Played ${Math.floor(mins / 60)}h ${mins % 60}m ago`)

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
  onTogglePause,
  readOnly = false,
  watchingLabel
}) => {
  const [songRequests, setSongRequests] = useState<SongRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [sizeIdx, setSizeIdx] = useState(() => Math.min(2, Math.max(0, Number(readPref('monitor_size', '1')) || 1)))
  const [showDone, setShowDone] = useState(false)
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set())
  const [pauseDeviceId, setPauseDeviceId] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [glow, setGlow] = useState<{ id: number; tipped: boolean } | null>(null)
  // "New tip" notice shown inside the monitor, and the sound that goes with it
  const [tipNotice, setTipNotice] = useState<{ id: number; text: string } | null>(null)
  const [soundOn, setSoundOn] = useState(() => readPref('monitor_tip_sound', '1') === '1')
  const [soundReady, setSoundReady] = useState(false)
  const soundOnRef = useRef(soundOn)
  soundOnRef.current = soundOn
  const noticeId = useRef(0)
  const [undo, setUndo] = useState<{ request: SongRequest; message: string } | null>(null)
  const [held, setHeld] = useState(false)
  const shownRef = useRef<SongRequest[]>([])
  const glowId = useRef(0)
  const releaseTimer = useRef<number | undefined>(undefined)
  const knownKeys = useRef<Set<string> | null>(null)
  // Tips with no song: the list, which the performer has marked seen (kept on this device), and which were already announced
  const [plainTips, setPlainTips] = useState<PlainTip[]>([])
  // All the tips without a song in this show, against how many the list holds, so a long show says that older ones are not listed
  const [plainTipsTotal, setPlainTipsTotal] = useState(0)
  // The queue is for one show: the current one, or an earlier one the performer picks. null means "the current show".
  const [pickedShowId, setPickedShowId] = useState<string | null>(null)
  const [refundTips, setRefundTips] = useState<RefundableTip[] | null>(null)
  const [seenTips, setSeenTips] = useState<Set<string>>(() => new Set(readPref(SEEN_TIPS_KEY, '').split(',').filter(Boolean)))
  const [showSeenTips, setShowSeenTips] = useState(false)
  const knownTipIds = useRef<Set<string> | null>(null)
  const wakeLockRef = useRef<any>(null)
  const pauseInitRef = useRef(false)

  const size = SIZES[sizeIdx]
  const { dark, className: themeClass } = usePortalTheme()
  const { setPreference } = useTheme()

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
      const response = await fetch(`${API_BASE_URL}/api/SongCatalog/monitor/${profileId}?_t=${Date.now()}${pickedShowId ? `&showId=${pickedShowId}` : ''}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        const list: SongRequest[] = data.songRequests || []
        setSongRequests(list)
        setLoadFailed(false)

        let announced = false

        // Flag requests that were not there on the previous refresh. They stay flagged until the performer has seen them.
        const keys = new Set(list.map(requestKey))
        if (knownKeys.current) {
          const added = list
            .filter(r => r.status === 'pending')
            .map(requestKey)
            .filter(k => !knownKeys.current!.has(k))
          if (added.length > 0) {
            setFreshKeys(prev => new Set([...prev, ...added]))
            const tippedRequests = list.filter(r => added.includes(requestKey(r)) && r.totalTipAmount > 0)
            const tipped = tippedRequests.length > 0
            glowId.current += 1
            setGlow({ id: glowId.current, tipped })
            if (tipped) {
              const total = tippedRequests.reduce((sum, r) => sum + r.totalTipAmount, 0)
              noticeId.current += 1
              setTipNotice({
                id: noticeId.current,
                text: tippedRequests.length === 1 ? `New tip ${money(total)}: ${tippedRequests[0].songTitle}` : `${tippedRequests.length} new tips: ${money(total)}`
              })
              if (soundOnRef.current) playTipChime()
              announced = true
            }
          }
        }
        knownKeys.current = keys

        // Tips of the chosen amounts that came with no song: list them, and announce new ones like song tips
        const plain: PlainTip[] = data.tipsWithoutSong || []
        setPlainTips(plain)
        setPlainTipsTotal(typeof data.tipsWithoutSongTotal === 'number' ? data.tipsWithoutSongTotal : plain.length)
        if (knownTipIds.current) {
          const addedTips = plain.filter(t => !knownTipIds.current!.has(t.id))
          if (addedTips.length > 0) {
            glowId.current += 1
            setGlow({ id: glowId.current, tipped: true })
            if (!announced) {
              const total = addedTips.reduce((sum, t) => sum + t.amount, 0)
              noticeId.current += 1
              setTipNotice({
                id: noticeId.current,
                text: addedTips.length === 1 ? `New tip ${money(total)}` : `${addedTips.length} new tips: ${money(total)}`
              })
              if (soundOnRef.current) playTipChime()
            }
          }
        }
        knownTipIds.current = new Set(plain.map(t => t.id))
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
  }, [profileId, pickedShowId])

  // The list of shows to pick from, loaded when the monitor opens (a page at a time, with "older shows" for the rest).
  // Watching someone else's screen: the show list would be the watcher's own, so it is left out; the queue shows their current show.
  const { shows, hasMore: moreShows, loadMore: loadMoreShows, loadingMore: loadingMoreShows } = useShowList(isVisible && !readOnly)

  // Switching shows is not new activity: start the "what is new" tracking again so nothing glows or chimes
  useEffect(() => {
    knownKeys.current = null
    knownTipIds.current = null
    setFreshKeys(new Set())
  }, [pickedShowId])

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
        if (newStatus === 'skipped') setUndo({ request, message: `Skipped “${request.songTitle}”` })
        else if (newStatus === 'completed' && request.status === 'pending') setUndo({ request, message: `Marked “${request.songTitle}” as played` })
        else if (newStatus === 'pending') setUndo(null)
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

  // Clear a request's NEW flag once it has been on screen for a moment
  useEffect(() => {
    if (!isVisible || freshKeys.size === 0) return
    const timers = new Map<Element, number>()
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const key = entry.target.getAttribute('data-key')
          const pending = timers.get(entry.target)
          if (pending) {
            window.clearTimeout(pending)
            timers.delete(entry.target)
          }
          if (!entry.isIntersecting || !key) return
          timers.set(
            entry.target,
            window.setTimeout(() => {
              if (document.visibilityState !== 'visible') return
              setFreshKeys(prev => new Set([...prev].filter(k => k !== key)))
            }, 2500)
          )
        })
      },
      { threshold: 0.6 }
    )
    document.querySelectorAll('[data-fresh="true"]').forEach(el => observer.observe(el))
    return () => {
      observer.disconnect()
      timers.forEach(t => window.clearTimeout(t))
    }
  }, [isVisible, freshKeys, songRequests])

  // Pending count in the tab title, so a background tab still shows what is waiting
  const pendingTotal = songRequests.filter(r => r.status === 'pending').length
  useEffect(() => {
    if (!isVisible) return
    const original = document.title
    document.title = pendingTotal > 0 ? `(${pendingTotal}) Live` : 'Live'
    return () => {
      document.title = original
    }
  }, [isVisible, pendingTotal])

  // Undo window after a skip
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), 7000)
    return () => window.clearTimeout(t)
  }, [undo])

  // The list holds still while a finger is on it, so a new bigger tip cannot slide a different song under the tap
  const holdStart = () => {
    window.clearTimeout(releaseTimer.current)
    setHeld(true)
    releaseTimer.current = window.setTimeout(() => setHeld(false), 8000)
  }
  const holdEnd = () => {
    window.clearTimeout(releaseTimer.current)
    releaseTimer.current = window.setTimeout(() => setHeld(false), 400)
  }
  useEffect(() => () => window.clearTimeout(releaseTimer.current), [])

  const changeSize = (delta: number) => {
    const next = Math.min(2, Math.max(0, sizeIdx + delta))
    setSizeIdx(next)
    writePref('monitor_size', String(next))
  }


  // Hide the "new tip" notice after a few seconds
  useEffect(() => {
    if (!tipNotice) return
    const t = window.setTimeout(() => setTipNotice(null), 6000)
    return () => window.clearTimeout(t)
  }, [tipNotice])

  // Browsers allow sound only after a touch: the first one on the monitor unlocks the chime
  useEffect(() => {
    if (!isVisible) return
    setSoundReady(isTipChimeReady())
    const unlock = () => {
      void unlockTipChime().then(ok => {
        setSoundReady(ok)
        if (ok) document.removeEventListener('pointerdown', unlock)
      })
    }
    document.addEventListener('pointerdown', unlock)
    return () => document.removeEventListener('pointerdown', unlock)
  }, [isVisible])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    writePref('monitor_tip_sound', next ? '1' : '0')
    if (next) void unlockTipChime().then(ok => { setSoundReady(ok); if (ok) playTipChime() })
  }

  if (!isVisible) return null

  // While a finger is down the list keeps the order it had, then catches up
  if (!held) shownRef.current = songRequests
  const shown = shownRef.current

  const markTipSeen = (id: string) => {
    setSeenTips(prev => {
      const next = new Set(prev).add(id)
      writePref(SEEN_TIPS_KEY, [...next].slice(-200).join(','))
      return next
    })
  }
  const markTipUnseen = (id: string) => {
    setSeenTips(prev => {
      const next = new Set(prev)
      next.delete(id)
      writePref(SEEN_TIPS_KEY, [...next].join(','))
      return next
    })
  }
  const newTips = plainTips.filter(t => !seenTips.has(t.id))
  const seenList = plainTips.filter(t => seenTips.has(t.id))

  // Asking for a refund: only tips from the last 7 days, and not ones already asked about
  const REFUND_WINDOW_MS = 7 * 24 * 3600 * 1000
  const requestRefundFor = (r: SongRequest) => {
    const items = (r.items ?? []).filter(i => Date.now() - new Date(i.createdAt).getTime() <= REFUND_WINDOW_MS)
    if (items.length === 0) return null
    if (items.every(i => i.refundRequest === 'pending')) return <StatusChip kind="processing" label="Refund requested" />
    if (readOnly) return null
    const open = items.filter(i => i.refundRequest !== 'pending')
    return (
      <button
        type="button"
        onClick={() =>
          setRefundTips(open.map(i => ({ ...(i.tipId ? { tipId: i.tipId } : { songRequestId: i.requestId }), amount: i.amount, createdAt: i.createdAt })))
        }
        className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-slate-100 hover:text-ink-700"
        aria-label={`Request a refund for ${r.songTitle}`}
      >
        Request refund
      </button>
    )
  }
  const requestRefundForTip = (t: PlainTip) => {
    if (t.refundRequest === 'pending') return <StatusChip kind="processing" label="Refund requested" />
    if (t.refundRequest === 'declined') return <StatusChip kind="offline" label="Not refunded" />
    if (t.status && t.status !== 'processed') return null
    if (Date.now() - new Date(t.createdAt).getTime() > REFUND_WINDOW_MS) return null
    if (readOnly) return null
    return (
      <button
        type="button"
        onClick={() => setRefundTips([{ tipId: t.id, amount: t.amount, createdAt: t.createdAt }])}
        className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-slate-100 hover:text-ink-700"
        aria-label={`Request a refund for the ${money(t.amount)} tip`}
      >
        Request refund
      </button>
    )
  }

  // Waiting by tip (highest first) and age, playing first, then everything finished
  const byTipThenAge = (a: SongRequest, b: SongRequest) =>
    b.totalTipAmount - a.totalTipAmount || new Date(a.firstRequestTime).getTime() - new Date(b.firstRequestTime).getTime()
  const performing = shown.filter(r => r.status === 'performing').sort(byTipThenAge)
  const pending = shown.filter(r => r.status === 'pending').sort(byTipThenAge)
  const done = shown
    .filter(r => r.status === 'completed' || r.status === 'skipped' || r.status === 'cancelled')
    .sort((a, b) => new Date(b.lastRequestTime).getTime() - new Date(a.lastRequestTime).getTime())

  const btn =
    'inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-lg font-bold transition-colors active:scale-[0.98] disabled:opacity-50'
  const sectionLabel = 'mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-700'
  const soft = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-ink-700 hover:bg-slate-200 disabled:opacity-50'

  const Note = ({ r }: { r: SongRequest }) =>
    r.requestorName || r.note ? (
      <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-ink-700">
        {r.requestorName && (
          <div className="flex items-center gap-2 font-semibold text-ink-900">
            <BrandIcon name="user" size={16} />
            {r.requestorName}
          </div>
        )}
        {r.note && <div className={`${r.requestorName ? 'mt-1' : ''} leading-snug`}>{r.note}</div>}
      </div>
    ) : null

  const TipBadge = ({ r }: { r: SongRequest }) => r.isTest ? (
    <span className={`inline-flex items-center rounded-full bg-amber-400 px-3 py-1 font-extrabold text-black ${size.chip}`} title="A test from the Tipwave team: no money was sent">
      TEST · $0.00
      {r.requestCount > 1 && <span className="ml-2 font-semibold">· {r.requestCount} requests</span>}
    </span>
  ) : (
    <span className={`inline-flex items-center rounded-full bg-accent-500 px-3 py-1 font-bold text-white ${size.chip}`}>
      ${r.totalTipAmount.toFixed(2)}
      {r.requestCount > 1 && <span className="ml-2 font-semibold text-white/85">· {r.requestCount} requests</span>}
    </span>
  )

  const glowColor = glow?.tipped ? '229,84,140' : '6,182,200'

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-surface text-ink-900 ${themeClass}`}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-label="Live queue"
    >
      <style>{`@keyframes monitor-glow{0%{opacity:0}20%{opacity:1}100%{opacity:0}}`}</style>

      {/* A new request pulses the screen edge, so it shows in peripheral vision without covering anything */}
      {glow && (
        <div
          key={glow.id}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-40"
          style={{
            boxShadow: `inset 0 0 0 6px rgba(${glowColor},0.95), inset 0 0 60px 14px rgba(${glowColor},0.55)`,
            animation: 'monitor-glow 1.8s ease-out forwards'
          }}
          onAnimationEnd={() => setGlow(null)}
        />
      )}

      {/* Browsers keep a page silent until it is touched once: ask for that touch, then get out of the way */}
      {soundOn && !soundReady && (
        <div className="absolute inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <button
            onClick={() => void unlockTipChime().then(ok => { setSoundReady(ok); if (ok) playTipChime() })}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-ink-900 px-5 text-sm font-bold text-white shadow-lift"
          >
            <BrandIcon name="volume" size={20} tone="inverse" />
            Tap to turn on tip sounds
          </button>
        </div>
      )}

      {/* A tip arrived: a short message at the top, announced to screen readers, gone after a few seconds */}
      {tipNotice && (
        <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-16 z-50 flex justify-center px-4">
          <div className="max-w-full truncate rounded-full bg-accent-500 px-5 py-2.5 text-base font-bold text-white shadow-lift">
            {tipNotice.text}
          </div>
        </div>
      )}

      {readOnly && (
        <div role="status" className="flex-none bg-amber-400 px-3 py-1.5 text-center text-xs font-bold text-black">
          {watchingLabel || 'Watching a performer'} · view only: nothing here changes their screen
        </div>
      )}

      {/* Top bar: slim, so it fits a narrow side window. Less-used controls live in the menu. */}
      <header className="relative flex flex-none items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
        <button onClick={onClose} className={`${soft} pl-2`} aria-label="Close Live">
          <BrandIcon name="chevron-left" size={20} tone="current" />
          <span className="hidden sm:inline">Close</span>
        </button>

        <h1 className="truncate text-lg font-bold">Live</h1>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${loadFailed ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-ink-700'}`}
          role="status"
        >
          <span className={`h-2 w-2 rounded-full ${loadFailed ? 'bg-amber-400' : 'animate-pulse bg-emerald-500'}`} />
          {loadFailed ? 'Reconnecting…' : loading && songRequests.length === 0 ? 'Loading…' : 'Live'}
        </span>

        <span
          className={`ml-auto flex h-9 min-w-[2.25rem] items-center justify-center rounded-full px-3 text-base font-extrabold ${
            pendingTotal > 0 ? 'bg-accent-500 text-white' : 'bg-slate-100 text-ink-500'
          }`}
          aria-label={`${pendingTotal} waiting`}
          title={`${pendingTotal} waiting`}
        >
          {pendingTotal}
        </span>

        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-expanded={menuOpen}
          aria-label="More options"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl font-bold text-ink-700"
        >
          ⋯
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="absolute right-3 top-full z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lift">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink-700">Text size</span>
                <div className="flex items-center rounded-xl bg-slate-100" role="group" aria-label="Text size">
                  <button onClick={() => changeSize(-1)} disabled={sizeIdx === 0} className="h-11 w-11 text-lg font-bold text-ink-700 disabled:opacity-30" aria-label="Smaller text">
                    A−
                  </button>
                  <button onClick={() => changeSize(1)} disabled={sizeIdx === 2} className="h-11 w-11 text-xl font-bold text-ink-700 disabled:opacity-30" aria-label="Larger text">
                    A+
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-ink-700">Sound for new tips</span>
                  <button
                    onClick={toggleSound}
                    role="switch"
                    aria-checked={soundOn}
                    aria-label="Sound for new tips"
                    className={`${soft} gap-2`}
                  >
                    <BrandIcon name="volume" size={20} />
                    {soundOn ? 'On' : 'Off'}
                  </button>
                </div>
                {soundOn && !soundReady && (
                  <p className="mt-1 text-xs text-ink-500">Tap anywhere on this screen once to allow sound.</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink-700">Theme</span>
                <button
                  onClick={() => setPreference(dark ? 'light' : 'dark')}
                  aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                  className={`${soft} gap-2`}
                >
                  <BrandIcon name={dark ? 'sun' : 'moon'} size={20} />
                  {dark ? 'Light' : 'Dark'}
                </button>
              </div>

              {onTogglePause && devices.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {devices.length > 1 && (
                    <select
                      value={selectedPauseDevice?.id ?? ''}
                      onChange={e => setPauseDeviceId(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-ink-900"
                      aria-label="Choose a device to pause"
                    >
                      <option value="">Choose device</option>
                      {devices.map(d => (
                        <option key={d.id} value={d.id}>
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
                      className={`${soft} w-full font-bold ${selectedPauseDevice.isPaused ? '!bg-amber-400 !text-ink-900 hover:!bg-amber-300' : ''}`}
                    >
                      <BrandIcon name={selectedPauseDevice.isPaused ? 'play' : 'pause'} size={18} tone="current" />
                      {selectedPauseDevice.isPaused ? 'Resume device' : devices.length === 1 ? `Pause ${devices[0].nickname || 'device'}` : 'Pause device'}
                    </button>
                  )}
                  {pausedCount > 0 && !selectedPauseDevice?.isPaused && (
                    <p className="text-sm font-semibold text-amber-700">{pausedCount > 1 ? 'Several devices paused' : 'A device is paused'}</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </header>

      {/* On a venue's device: how long the session has left, so the end of it is never a surprise */}
      {!readOnly && (
        <div className="flex-none">
          <SessionBanner compact />
        </div>
      )}

      {/* Paused devices stay visible even with the menu closed, since tippers get no light or sound */}
      {pausedCount > 0 && (
        <div className="flex-none bg-amber-100 px-4 py-1.5 text-center text-sm font-semibold text-amber-900">
          {pausedCount > 1 ? 'Several devices are paused' : 'A device is paused'}
        </div>
      )}

      {/* Queue. Requests come first; on a wide screen "Playing now" moves to a side column. */}
      <main
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        onPointerDown={holdStart}
        onPointerUp={holdEnd}
        onPointerCancel={holdEnd}
      >
        {!readOnly && shows.length > 1 && (
          <div className="mx-auto mb-3 flex max-w-6xl items-center gap-2 text-sm text-ink-500">
            <label htmlFor="monitor-show">Show</label>
            <select
              id="monitor-show"
              value={pickedShowId ?? ''}
              onChange={e => setPickedShowId(e.target.value || null)}
              className="max-w-[16rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-ink-900"
            >
              {shows.map((sh, i) => (
                <option key={sh.id} value={i === 0 ? '' : sh.id}>
                  {showTitle(sh, shows)}
                  {sh.isLive ? ' (live)' : ''}
                  {i === 0 ? '' : ` · ${new Date(sh.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                </option>
              ))}
            </select>
            {moreShows && (
              <button
                type="button"
                onClick={() => void loadMoreShows()}
                disabled={loadingMoreShows}
                className="rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {loadingMoreShows ? 'Loading…' : 'Older shows'}
              </button>
            )}
          </div>
        )}
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* Playing now */}
          <section
            aria-label="Playing now"
            className={`lg:order-2 lg:sticky lg:top-0 lg:self-start ${performing.length === 0 ? 'hidden lg:block' : ''}`}
          >
            <h2 className={`${sectionLabel} hidden lg:flex`}>Playing now</h2>
            {performing.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-ink-500">
                <p className="font-semibold text-ink-900">Nothing playing</p>
                <p className="mt-1 text-sm">Tap “Play this” on a request when you start it.</p>
              </div>
            ) : (
              performing.map(r => {
                const key = requestKey(r)
                return (
                  <React.Fragment key={key}>
                  {/* Narrow window: one slim row so the requests stay in view */}
                  <article className="mb-1 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-lift lg:hidden">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-700">
                        <BrandIcon name="music" size={14} />
                        Playing
                        {r.isTest && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-black">TEST</span>}
                      </div>
                      <div className="truncate font-bold text-ink-900">{r.songTitle}</div>
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() => updateSongStatus(r, 'completed')}
                        disabled={updatingStatus === key}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 font-bold text-white hover:bg-brand-800 disabled:opacity-50"
                      >
                        <BrandIcon name="check" size={20} color="#FFFFFF" strokeWidth={2.4} />
                        {updatingStatus === key ? 'Saving…' : 'Done playing'}
                      </button>
                    )}
                  </article>
                  <article className="mb-3 hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-lift lg:block">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip kind="active" label="Playing" />
                      <TipBadge r={r} />
                    </div>
                    <h3 className={`mt-3 font-extrabold leading-tight text-ink-900 ${size.title}`}>{r.songTitle}</h3>
                    <p className={`text-ink-500 ${size.artist}`}>{r.artist}</p>
                    <Note r={r} />
                    {!readOnly && (
                      <button
                        onClick={() => updateSongStatus(r, 'completed')}
                        disabled={updatingStatus === key}
                        className={`${btn} mt-4 w-full bg-brand-700 text-white hover:bg-brand-800`}
                      >
                        <BrandIcon name="check" size={22} color="#FFFFFF" strokeWidth={2.4} />
                        {updatingStatus === key ? 'Saving…' : 'Done playing'}
                      </button>
                    )}
                  </article>
                  </React.Fragment>
                )
              })
            )}
          </section>

          {/* Up next */}
          <section aria-label="Up next" className="lg:order-1">
            <h2 className={sectionLabel}>
              Up next
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-ink-700">{pending.length}</span>
            </h2>

            {pending.length === 0 ? (
              <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
                  <BrandIcon name="music" size={28} />
                </span>
                <p className="mt-4 text-lg font-semibold text-ink-900">No requests waiting</p>
                <p className="mt-1 text-ink-500">New requests appear here the moment someone tips.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {pending.map((r, i) => {
                  const key = requestKey(r)
                  const fresh = freshKeys.has(key)
                  return (
                    <li
                      key={key}
                      data-key={key}
                      data-fresh={fresh ? 'true' : 'false'}
                      className={`rounded-3xl border p-4 transition-colors ${
                        fresh ? 'border-accent-400 bg-accent-50 ring-2 ring-accent-400' : 'border-slate-100 bg-white'
                      }`}
                      style={fresh && dark ? { backgroundColor: 'rgba(229,84,140,0.18)' } : undefined}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-ink-700">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <TipBadge r={r} />
                            {fresh && <span className="rounded-full bg-accent-600 px-2.5 py-1 text-xs font-extrabold text-white">NEW</span>}
                            {r.playedMinutesAgo != null && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-900">
                                <BrandIcon name="check" size={14} tone="current" strokeWidth={2.4} />
                                {playedAgo(r.playedMinutesAgo)}
                              </span>
                            )}
                            <span className="text-sm text-ink-500">{ago(r.firstRequestTime, now)}</span>
                          </div>
                          <h3 className={`mt-2 font-bold leading-tight text-ink-900 ${size.title}`}>{r.songTitle}</h3>
                          <p className={`text-ink-500 ${size.artist}`}>{r.artist}</p>
                          <Note r={r} />
                        </div>
                      </div>
                      {readOnly ? (
                        // Watching: no buttons, only the refund status a performer would see
                        requestRefundFor(r) ? <div className="mt-3 flex flex-wrap items-center gap-2">{requestRefundFor(r)}</div> : null
                      ) : (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => updateSongStatus(r, 'performing')}
                          disabled={updatingStatus === key}
                          className={`${btn} h-12 min-w-[9rem] flex-1 bg-brand-700 text-white hover:bg-brand-800`}
                        >
                          <BrandIcon name="play" size={22} color="#FFFFFF" />
                          {updatingStatus === key ? 'Saving…' : 'Play this'}
                        </button>
                        <button
                          onClick={() => updateSongStatus(r, 'completed')}
                          disabled={updatingStatus === key}
                          className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-slate-100 hover:text-ink-700 disabled:opacity-50"
                          aria-label={`Mark ${r.songTitle} as already played`}
                        >
                          Already played
                        </button>
                        <button
                          onClick={() => updateSongStatus(r, 'skipped')}
                          disabled={updatingStatus === key}
                          className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-slate-100 hover:text-ink-700 disabled:opacity-50"
                          aria-label={`Skip ${r.songTitle}`}
                        >
                          Skip
                        </button>
                        {requestRefundFor(r)}
                      </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Tips of the amounts the performer chose to see, with no song attached */}
            {plainTips.length > 0 && (
              <section aria-label="Tips without a song" className="mt-6">
                <h2 className={sectionLabel}>
                  Tips without a song
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-ink-700">{newTips.length}</span>
                </h2>
                {plainTipsTotal > plainTips.length && (
                  <p className="mb-2 text-xs text-ink-500" role="note">
                    Showing the newest {plainTips.length} of {plainTipsTotal} tips without a song in this show.
                  </p>
                )}
                {newTips.length === 0 ? (
                  <p className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-ink-500">All seen.</p>
                ) : (
                  <ul className="space-y-2">
                    {newTips.map(t => (
                      <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                        <span className={`inline-flex items-center rounded-full bg-accent-500 px-3 py-1 font-bold text-white ${size.chip}`}>{money(t.amount)}</span>
                        <span className="min-w-[8rem] flex-1 truncate text-sm text-ink-500">
                          <span className="font-semibold text-ink-700">{timeOfDay(t.createdAt)}</span> · {ago(t.createdAt, now)}
                        </span>
                        {requestRefundForTip(t)}
                        {!readOnly && (
                          <button
                            onClick={() => markTipSeen(t.id)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-ink-700 hover:bg-slate-200"
                            aria-label={`Mark the ${money(t.amount)} tip as seen`}
                          >
                            <BrandIcon name="check" size={18} tone="current" strokeWidth={2.4} />
                            Seen
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {seenList.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowSeenTips(s => !s)}
                      aria-expanded={showSeenTips}
                      className="flex h-11 items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700"
                    >
                      <BrandIcon name={showSeenTips ? 'chevron-down' : 'chevron-right'} size={18} tone="current" />
                      {showSeenTips ? 'Hide' : 'Show'} seen ({seenList.length})
                    </button>
                    {showSeenTips && (
                      <ul className="mt-1 space-y-2">
                        {seenList.map(t => (
                          <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-2">
                            <span className="font-semibold text-ink-900">{money(t.amount)}</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-ink-500">
                              <span className="font-semibold text-ink-700">{timeOfDay(t.createdAt)}</span> · {ago(t.createdAt, now)}
                            </span>
                            {requestRefundForTip(t)}
                            {!readOnly && (
                              <button onClick={() => markTipUnseen(t.id)} className="h-11 rounded-xl px-3 text-sm font-semibold text-ink-500 hover:bg-slate-100">
                                Undo
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Finished requests stay out of the way until asked for */}
            {done.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowDone(s => !s)}
                  aria-expanded={showDone}
                  className="flex h-11 items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-700"
                >
                  <BrandIcon name={showDone ? 'chevron-down' : 'chevron-right'} size={18} tone="current" />
                  {showDone ? 'Hide' : 'Show'} finished ({done.length})
                </button>
                {showDone && (
                  <ul className="mt-2 space-y-2">
                    {done.map(r => (
                      <li key={requestKey(r)} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-ink-900">{r.songTitle}</div>
                          <div className="truncate text-sm text-ink-500">{r.artist}</div>
                        </div>
                        {requestRefundFor(r)}
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

      <RefundRequestDialog
        open={!!refundTips}
        tips={refundTips ?? []}
        onClose={() => setRefundTips(null)}
        onRequested={() => void loadSongRequests()}
      />

      {/* Undo for a skip, so a stray tap costs nothing */}
      {undo && (
        <div
          className="absolute inset-x-3 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-lift"
          role="status"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{undo.message}</span>
          <button
            onClick={() => updateSongStatus(undo.request, 'pending')}
            className="h-10 rounded-xl bg-white/15 px-4 text-sm font-bold hover:bg-white/25"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

export default SongRequestMonitor
