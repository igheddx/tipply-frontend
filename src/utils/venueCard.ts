import { renderQrCard } from './qrCard'
import { fetchQrPng } from './qrImage'

/**
 * Downloads a performer's own printable card for a venue's device: the same card as for their own devices, with their name,
 * but a QR code that only takes tips while that performer is the one using the device.
 */
export async function downloadPerformerVenueCard(deviceId: string, deviceName: string, performerId: string, stageName: string): Promise<void> {
  const png = await fetchQrPng(deviceId, performerId)
  const bitmap = await createImageBitmap(png)
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
