import { renderQrCard } from './qrCard'
import { API_BASE_URL } from './config'

/**
 * Downloads a performer's own printable card for a venue's device: the same card as for their own devices, with their name,
 * but a QR code that only takes tips while that performer is the one using the device.
 */
export async function downloadPerformerVenueCard(deviceId: string, deviceName: string, performerId: string, stageName: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/qr?performerId=${encodeURIComponent(performerId)}`, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Could not get the QR code (${response.status})`)
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = await renderQrCard(bitmap, stageName)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not create the card')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tipwave-card-${stageName}-${deviceName}.png`.replace(/\s+/g, '-')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
