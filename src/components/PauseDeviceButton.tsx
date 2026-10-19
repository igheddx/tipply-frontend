import React from 'react'
import { PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'

interface PauseDeviceButtonProps {
  isPaused: boolean
  busy: boolean
  onToggle: () => void
}

// Small, low-key icon that pauses or resumes a device's light and sound. Tips still go through while paused.
const PauseDeviceButton: React.FC<PauseDeviceButtonProps> = ({ isPaused, busy, onToggle }) => {
  const label = isPaused
    ? 'Resume device (turn light and sound back on)'
    : 'Pause device (stops light and sound, tips still go through)'

  return (
    <button
      onClick={onToggle}
      disabled={busy}
      title={label}
      aria-label={label}
      className={`text-lg leading-none transition-colors disabled:opacity-50 ${
        isPaused ? 'text-amber-600 hover:text-amber-700' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
    </button>
  )
}

export default PauseDeviceButton
