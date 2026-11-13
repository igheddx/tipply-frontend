import { useEffect, useState } from 'react'
import { apiService } from '../services/api'
import { Card, Switch } from './ui'

/**
 * A performer's own choice (off until they turn it on): when a tipper taps an amount without having chosen a song, the tip page first
 * asks whether they would like to request one. They can always skip it and just tip.
 */
export default function SongPromptCard() {
  const [on, setOn] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiService.get('/api/profiles/me/song-prompt').then(r => {
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
    const response = await apiService.put('/api/profiles/me/song-prompt', { askForSongFirst: next })
    setSaving(false)
    if (typeof response.data?.askForSongFirst === 'boolean') {
      setOn(response.data.askForSongFirst)
    } else {
      setOn(!next)
      setError('Could not save. Please try again.')
    }
  }

  return (
    <Card title="Song requests on the tip page" subtitle="Choose whether tippers are asked about a song when they tap an amount.">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 p-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">Ask tippers if they want to request a song</div>
          <p className="mt-0.5 text-xs text-ink-500">
            When someone taps an amount, they are first asked whether they would like to request a song, with a clear “No thanks, just tip” button.
            Anyone who already picked a song with the “Request a song” button is not asked again. It only applies when you take song requests.
            Off by default: tips stay one tap.
          </p>
        </div>
        <Switch checked={on} disabled={!loaded || saving} onChange={() => void toggle()} label="Ask tippers if they want to request a song" />
      </div>
      {error && (
        <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      )}
    </Card>
  )
}
