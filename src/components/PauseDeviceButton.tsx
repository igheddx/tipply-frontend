import React from 'react'

interface PauseDeviceButtonProps {
  isPaused: boolean
  busy: boolean
  onToggle: () => void
}

// Low-key row for pausing a device's light and sound. Tips still go through while paused.
const PauseDeviceButton: React.FC<PauseDeviceButtonProps> = ({ isPaused, busy, onToggle }) => (
  <div>
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-gray-700">Pause Device</span>
        <p className="text-xs text-gray-500">Stops the light and sound. Tips still go through.</p>
      </div>
      <button
        onClick={onToggle}
        disabled={busy}
        className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
      >
        {busy ? '...' : isPaused ? 'Resume' : 'Pause'}
      </button>
    </div>
    {isPaused && <p className="mt-1 text-xs text-amber-700">Paused: no light or sound.</p>}
  </div>
)

export default PauseDeviceButton
