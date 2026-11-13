import { useState } from 'react'
import { apiService } from '../services/api'
import { Switch } from './ui'

interface DeviceSongPromptSwitchProps {
  deviceId: string
  /** The saved choice for this device (off by default) */
  checked: boolean
  /** Called with the saved value once the server has it */
  onSaved: (value: boolean) => void
}

/**
 * Sits under a device's "Song requests" switch (and only shows while that is on). When on, a tipper who taps an amount without having
 * chosen a song is first asked whether to request one, with a clear "No thanks, just tip" button. Stored for this performer and this
 * device together, so a device that moves to someone else starts them at the default (off).
 */
export default function DeviceSongPromptSwitch({ deviceId, checked, onSaved }: DeviceSongPromptSwitchProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = async () => {
    setSaving(true)
    setError('')
    const response = await apiService.updateSongPromptSetting(deviceId, !checked)
    setSaving(false)
    if (typeof response.data?.askForSongFirst === 'boolean') onSaved(response.data.askForSongFirst)
    else setError('Could not save. Please try again.')
  }

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900">Ask when an amount is tapped</div>
          <div className="text-xs text-ink-500">
            Before the tip is sent, ask if they would like to request a song. They can skip it and just tip. Anyone who already picked a song is not asked
            again. Off keeps tips at one tap.
          </div>
        </div>
        <Switch checked={checked} disabled={saving} label="Ask when an amount is tapped" onChange={() => void toggle()} />
      </div>
      {error && (
        <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
