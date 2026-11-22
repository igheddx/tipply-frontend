import { useEffect, useState } from 'react'
import { DisclosureChevron } from '../ui'
import { platformMixApi, type PlatformMix } from '../../services/platformMixApi'
import { PlatformMixView } from './PlatformMixView'

/**
 * The phones and ways of paying for one show, closed until the admin opens it. Nothing is asked of the server while it is closed, so the show
 * page loads exactly as fast as before; the numbers are read the first time it is opened for a show, and kept while the admin flips back and forth.
 */
export function ShowPlatformMix({ profileId, showId }: { profileId: string; showId: string }) {
  const [open, setOpen] = useState(false)
  // One entry per show already read: the numbers, or null when they could not be loaded
  const [seen, setSeen] = useState<Record<string, PlatformMix | null>>({})

  const key = `${profileId}/${showId}`
  const known = key in seen

  useEffect(() => {
    if (!open || known) return
    let cancelled = false
    void platformMixApi.show(profileId, showId).then(res => {
      if (cancelled) return
      setSeen(s => ({ ...s, [key]: res.data && Array.isArray(res.data.rows) ? (res.data as PlatformMix) : null }))
    })
    return () => {
      cancelled = true
    }
  }, [open, known, key, profileId, showId])

  const mix = seen[key]

  const toggle = () => {
    // Closing forgets a failed read, so opening it again tries again
    if (open && seen[key] === null) setSeen(s => Object.fromEntries(Object.entries(s).filter(([k]) => k !== key)))
    setOpen(o => !o)
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white shadow-card" aria-label="Phones and how they pay">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`show-phones-${showId}`}
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-ink-900">Phones and how they pay</span>
          <span className="block text-xs text-ink-700">iPhone, Android and other tippers in this show, and Apple or Google Pay versus a typed card</span>
        </span>
        <DisclosureChevron open={open} />
      </button>

      {open && (
        <div id={`show-phones-${showId}`} className="px-4 pb-4">
          {!known ? (
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
          ) : mix === null ? (
            <p className="text-sm text-ink-700">The numbers could not be loaded. Close this and open it again to retry.</p>
          ) : mix.tippers === 0 ? (
            <p className="text-sm text-ink-700">Nobody tipped in this show.</p>
          ) : (
            <PlatformMixView mix={mix} scope="in this show" />
          )}
        </div>
      )}
    </section>
  )
}
