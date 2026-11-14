import React, { useState } from 'react'
import { Button, Card } from './ui'
import TipAmountsEditor from './TipAmountsEditor'
import { LIGHT_EFFECTS } from '../utils/deviceConfig'

export interface TipButtonsDevice {
  id: string
  nickname?: string
}

interface TipButtonsCardProps {
  /** The performer's six amounts, smallest to largest */
  amounts: number[]
  devices: TipButtonsDevice[]
  /** The light a device fires for an amount */
  lightFor: (deviceId: string, amount: number) => string
  onLightChange: (deviceId: string, amount: number, effect: string) => void
  /** The device whose lights are being saved right now */
  busyDeviceId?: string | null
  savingAmounts: boolean
  onSaveAmounts: (amounts: number[]) => void
  onResetAmounts: () => void
}

const deviceName = (device: TipButtonsDevice, index: number) => device.nickname?.trim() || `Device ${index + 1}`

/**
 * The tip page's six buttons in one place: each row is an amount and the light it fires, left to right, the way the tipper sees them.
 * Amounts are changed with "Change amounts" (pick six from the list); a light is changed right in its row. Lights belong to a device,
 * so with more than one device a choice at the top says whose lights are shown.
 */
const TipButtonsCard: React.FC<TipButtonsCardProps> = ({ amounts, devices, lightFor, onLightChange, busyDeviceId, savingAmounts, onSaveAmounts, onResetAmounts }) => {
  const [editing, setEditing] = useState(false)
  const [deviceId, setDeviceId] = useState<string>(devices[0]?.id ?? '')
  const current = devices.find(d => d.id === deviceId) ?? devices[0]
  const busy = !!current && busyDeviceId === current.id

  return (
    <Card title="Your six tip buttons" subtitle="The amounts on your tip page (the same on every device) and the light each one fires (set for each device), left to right.">
      {devices.length > 1 && (
        <label className="mb-3 flex items-center gap-2 text-sm text-ink-500">
          Lights for
          <select
            value={current?.id ?? ''}
            onChange={e => setDeviceId(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-ink-900"
            aria-label="Device whose lights to show"
          >
            {devices.map((d, i) => (
              <option key={d.id} value={d.id}>
                {deviceName(d, i)}
              </option>
            ))}
          </select>
        </label>
      )}

      <ol className="divide-y divide-slate-100" aria-label="Tip buttons, left to right">
        {amounts.map((amount, i) => (
          <li key={amount} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-ink-700" aria-hidden>
                {i + 1}
              </span>
              <span className="text-base font-bold text-ink-900">${amount}</span>
            </span>
            {current ? (
              <select
                value={lightFor(current.id, amount)}
                onChange={e => onLightChange(current.id, amount, e.target.value)}
                disabled={busy}
                aria-label={`Light for the $${amount} button`}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                {LIGHT_EFFECTS.map(effect => (
                  <option key={effect.value} value={effect.value}>
                    {effect.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-ink-400">Add a device to choose lights</span>
            )}
          </li>
        ))}
      </ol>
      {busy && <p className="mt-1 text-center text-xs text-brand-700">Saving…</p>}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={() => setEditing(v => !v)} aria-expanded={editing}>
          {editing ? 'Done changing amounts' : 'Change amounts'}
        </Button>
        {editing && (
          <div className="mt-4">
            <TipAmountsEditor bare amounts={amounts} saving={savingAmounts} onSave={onSaveAmounts} onReset={onResetAmounts} />
          </div>
        )}
      </div>
    </Card>
  )
}

export default TipButtonsCard
