import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getApiBaseUrl } from '../../utils/config'
import logger from '../../utils/logger'
import { BrandIcon } from '../icons/BrandIcons'
import { Button } from '../ui'

interface Song {
  id: string
  songTitle: string
  artist: string
}

export interface PickedSong {
  id: string
  title: string
  artist: string
  requestorName?: string
  note?: string
}

interface SongPickerSheetProps {
  open: boolean
  deviceUuid: string
  /** Pre-filled when the tipper reopens the sheet to change their request */
  current?: PickedSong | null
  onClose: () => void
  onPick: (song: PickedSong) => void
}

/**
 * Bottom sheet for choosing a song. The tip page behind it never scrolls; the list inside the sheet is the
 * only scrolling region. The catalog shows straight away (A to Z), and typing narrows it down.
 */
export function SongPickerSheet({ open, deviceUuid, current, onClose, onPick }: SongPickerSheetProps) {
  const [query, setQuery] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(false)
  const [chosen, setChosen] = useState<Song | null>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const requestId = useRef(0)
  // Read at the moment the sheet opens, so a new `current` object on every parent render cannot reset the fields
  const currentRef = useRef(current)
  currentRef.current = current

  // Start fresh each time the sheet opens
  useEffect(() => {
    if (!open) return
    setQuery('')
    setChosen(null)
    setName(currentRef.current?.requestorName ?? '')
    setNote(currentRef.current?.note ?? '')
  }, [open])

  // Load the catalog, narrowed by what has been typed
  useEffect(() => {
    if (!open || !deviceUuid) return
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const search = query.trim()
        const url =
          `${getApiBaseUrl()}/api/songcatalog/performer/${deviceUuid}?limit=${search ? 50 : 100}` +
          (search ? `&search=${encodeURIComponent(search)}` : '')
        const response = await fetch(url)
        if (response.ok && id === requestId.current) setSongs(await response.json())
      } catch (error) {
        logger.error('Error loading songs:', error)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [open, deviceUuid, query])

  const confirm = () => {
    if (!chosen) return
    onPick({
      id: chosen.id,
      title: chosen.songTitle,
      artist: chosen.artist,
      requestorName: name.trim() || undefined,
      note: note.trim() || undefined
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-label="Pick a song"
            className="flex w-full flex-col rounded-t-[22px] bg-white text-ink-900 shadow-2xl"
            style={{ maxHeight: '85dvh', height: chosen ? 'auto' : '85dvh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 flex-none rounded-full bg-slate-300" />

            {chosen ? (
              <div className="flex flex-col gap-3 px-4 pb-1 pt-3">
                <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white">
                    <BrandIcon name="music" size={22} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-bold">{chosen.songTitle}</div>
                    <div className="truncate text-sm text-ink-500">{chosen.artist}</div>
                  </div>
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  placeholder="Your name (optional)"
                  className="rounded-xl border border-slate-300 px-3 py-3 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="Add a note (optional)"
                  className="resize-none rounded-xl border border-slate-300 px-3 py-3 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <p className="text-center text-xs text-ink-500">Next, tap a tip amount to send your request.</p>
                <Button size="lg" block onClick={confirm}>
                  Done
                </Button>
                <Button variant="ghost" block onClick={() => setChosen(null)}>
                  Choose a different song
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-none items-center justify-between px-4 pb-2 pt-3">
                  <h2 className="text-lg font-extrabold">Pick a song</h2>
                  <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full active:bg-slate-100">
                    <BrandIcon name="close" size={18} color="#64748B" />
                  </button>
                </div>
                <div className="mx-4 mb-1 flex flex-none items-center gap-2 rounded-xl border-[1.5px] border-brand-600 px-3 py-2.5">
                  <BrandIcon name="search" size={18} tone="muted" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search songs or artists"
                    aria-label="Search songs or artists"
                    className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-400"
                  />
                </div>
                <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
                  {songs.map((song) => (
                    <li key={song.id}>
                      <button
                        type="button"
                        onClick={() => setChosen(song)}
                        className="w-full border-b border-slate-100 py-3 text-left active:bg-slate-50"
                      >
                        <div className="text-[15px] font-semibold">{song.songTitle}</div>
                        <div className="text-xs text-ink-500">{song.artist}</div>
                      </button>
                    </li>
                  ))}
                  {!loading && songs.length === 0 && (
                    <li className="px-2 py-10 text-center text-sm text-ink-500">
                      {query.trim() ? `No songs match “${query.trim()}”.` : 'This performer has not added any songs yet. You can still send a tip.'}
                      {query.trim() && (
                        <button type="button" onClick={() => setQuery('')} className="mt-2 block w-full font-semibold text-brand-700">
                          Show all songs
                        </button>
                      )}
                    </li>
                  )}
                </ul>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
