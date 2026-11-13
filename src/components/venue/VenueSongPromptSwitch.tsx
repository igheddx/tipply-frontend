import { useEffect, useState } from 'react'
import { apiService } from '../../services/api'
import { Switch } from '../ui'

/**
 * The performer's own choice for whenever they use a venue's device: ask tippers about a song when an amount is tapped (off by default).
 * It is theirs and goes with their profile; it never changes the venue's settings.
 */
export default function VenueSongPromptSwitch() {
  const [on, setOn] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiService.get('/api/profiles/me/venue-song-prompt').then(r => {
      if (cancelled) return
      if (typeof r.data?.askForSongFirst === 'boolean') setOn(r.data.askForSongFirst)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = async () => {
    const next = !on
    setOn(next)
    setError('')
    setSaving(true)
    const response = await apiService.put('/api/profiles/me/venue-song-prompt', { askForSongFirst: next })
    setSaving(false)
    if (typeof response.data?.askForSongFirst === 'boolean') setOn(response.data.askForSongFirst)
    else {
      setOn(!next)
      setError('Could not save. Please try again.')
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">Ask for a song when an amount is tapped</div>
          <div className="text-xs text-ink-500">
            For when you perform on a venue's device: tippers are first asked if they would like to request a song, with a clear “No thanks, just tip”
            button. This is your own choice and goes with you; it does not change the venue's settings.
          </div>
        </div>
        <Switch checked={on} disabled={!loaded || saving} label="Ask for a song when an amount is tapped, on venue devices" onChange={() => void toggle()} />
      </div>
      {error && (
        <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
