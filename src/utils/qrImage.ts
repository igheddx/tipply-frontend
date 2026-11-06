import { API_BASE_URL } from './config'

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47]

const readBuffer = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

const isPng = async (blob: Blob) => {
  const head = new Uint8Array(await readBuffer(blob.slice(0, 4)))
  return PNG_BYTES.every((b, i) => head[i] === b)
}

/**
 * Gets a device's QR code as a real PNG. Depending on how the request passes through the API gateway the picture can come back as
 * base64 text instead of binary, which a browser cannot show; this turns that back into a PNG. Throws a plain message on failure.
 */
export async function fetchQrPng(deviceId: string, performerId?: string): Promise<Blob> {
  const url = `${API_BASE_URL}/api/devices/${deviceId}/qr${performerId ? `?performerId=${encodeURIComponent(performerId)}` : ''}`
  const response = await fetch(url, { headers: { Accept: 'image/png' }, cache: 'no-cache' })
  if (!response.ok) throw new Error(`The QR code could not be loaded (${response.status})`)

  const blob = await response.blob()
  if (await isPng(blob)) return blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' })

  // Base64 text of a PNG
  const text = new TextDecoder().decode(await readBuffer(blob)).trim()
  if (text.startsWith('iVBORw0KGgo') && /^[A-Za-z0-9+/=\s]+$/.test(text)) {
    const bytes = Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0))
    return new Blob([bytes], { type: 'image/png' })
  }
  throw new Error('The QR code came back in a format this browser cannot show')
}
