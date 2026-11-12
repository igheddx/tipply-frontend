import React from 'react'
import { Button } from './ui'

export interface LaunchableDevice {
  id: string
  nickname?: string
  serialNumber?: string
  isDeleted?: boolean
}

interface TestTipLauncherProps {
  performerName: string
  /** Needed for the "watch their Live screen" button */
  performerId?: string
  devices: LaunchableDevice[]
  /** Opens the test tip page for a device. Defaults to a new browser tab. */
  onLaunch?: (deviceId: string) => void
  /** Opens the view-only Live screen for the performer. Defaults to a new browser tab. */
  onWatch?: (performerId: string, performerName: string) => void
}

export const testTipPath = (deviceId: string) => `/admin/test-tip/${deviceId}`
/** The name is only for the label on the page; the screen itself is chosen by the id */
export const watchLivePath = (performerId: string, performerName: string) => `/admin/watch-live/${performerId}?n=${encodeURIComponent(performerName)}`

const openInNewTab = (deviceId: string) => {
  window.open(testTipPath(deviceId), '_blank', 'noopener')
}

const openWatchInNewTab = (performerId: string, performerName: string) => {
  window.open(watchLivePath(performerId, performerName), '_blank', 'noopener')
}

const label = (device: LaunchableDevice, index: number) => device.nickname?.trim() || (device.serialNumber ? `Device ${device.serialNumber}` : `Device ${index + 1}`)

/**
 * Admin only (Admin → Insights). Opens the performer's own tip page in test mode: tapping an amount fires that device's light (and its
 * sound, when it has sound on). Nothing is charged and no tip is saved. The page needs an admin sign-in, so a copied link does not work.
 */
const TestTipLauncher: React.FC<TestTipLauncherProps> = ({ performerName, performerId, devices, onLaunch = openInNewTab, onWatch = openWatchInNewTab }) => {
  const live = devices.filter(device => !device.isDeleted)

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-ink-900">Test and watch</h3>
      <p className="mt-1 text-sm text-ink-500">
        Opens {performerName}'s tip page in test mode, with their amounts and their light settings. Tapping an amount only fires the light, and the sound if
        their device has it on. Nothing is charged and nothing is saved against them. A test song request shows on their Live queue marked TEST at $0.
      </p>
      <h4 className="mt-4 text-sm font-semibold text-ink-900">Test the tip page</h4>
      {live.length === 0 ? (
        <p className="mt-3 text-sm italic text-ink-500">No device to test: this performer has no active device.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {live.map((device, i) => (
            <Button key={device.id} variant="secondary" icon="qr" onClick={() => onLaunch(device.id)}>
              {live.length === 1 ? 'Launch test tip page' : `Launch test: ${label(device, i)}`}
            </Button>
          ))}
        </div>
      )}
      {performerId && (
        <>
          <h4 className="mt-5 text-sm font-semibold text-ink-900">Watch their Live screen</h4>
          <p className="mt-1 text-sm text-ink-500">
            Opens the same Live screen {performerName} sees, updating as songs and tips come in, with no buttons that change anything. Sound and the
            new-request glow are only on your own screen.
          </p>
          <div className="mt-3">
            <Button variant="secondary" icon="music" onClick={() => onWatch(performerId, performerName)}>
              Watch {performerName}'s Live screen
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default TestTipLauncher
