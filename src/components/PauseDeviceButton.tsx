import React from 'react'

interface PauseDeviceButtonProps {
  isPaused: boolean
  busy: boolean
  onToggle: () => void
  deviceName?: string
}

// Critical control: stops (or restores) the device's light and sound. Tips keep working while paused.
const PauseDeviceButton: React.FC<PauseDeviceButtonProps> = ({ isPaused, busy, onToggle, deviceName }) => (
  <div
    className={`w-full rounded-xl border-2 p-3 ${
      isPaused ? 'border-amber-400 bg-amber-50' : 'border-red-300 bg-red-50'
    }`}
  >
    {isPaused && (
      <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-800">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
        {deviceName ? `${deviceName} is paused` : 'Device paused'} — no light or sound. Tips still work.
      </div>
    )}
    <button
      onClick={onToggle}
      disabled={busy}
      className={`w-full rounded-lg px-4 py-3 text-base font-extrabold uppercase tracking-wider text-white shadow-md transition-colors disabled:opacity-60 ${
        isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
      }`}
    >
      {busy ? 'Updating...' : isPaused ? '▶ Resume Device' : '⏸ Pause Device'}
    </button>
    {!isPaused && (
      <p className="mt-1 text-center text-xs text-red-700">
        Stops the light and sound for {deviceName || 'this device'}. Tips still go through.
      </p>
    )}
  </div>
)

export default PauseDeviceButton
