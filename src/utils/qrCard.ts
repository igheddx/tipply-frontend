import { drawBrandIcon } from '../components/icons/BrandIcons'

/**
 * The printable 4x6 in card (1200 x 1800 px, 300 dpi) a performer puts next to their device: the QR code in a
 * Tipwave-teal frame, a short how-to, the performer's name and the Tipwave logo. The QR code itself is
 * drawn at a fixed 900 px so it scans the same as before.
 */
export const QR_CARD_WIDTH = 1200
export const QR_CARD_HEIGHT = 1800

/** Print sizes, both at 300 dpi. The letter page carries the same card, enlarged to the page's height and centred. */
export type CardFormat = 'card' | 'letter'
export const CARD_FORMATS: Record<CardFormat, { width: number; height: number; label: string; inches: string }> = {
  card: { width: 1200, height: 1800, label: '4 × 6 in', inches: '4x6' },
  letter: { width: 2550, height: 3300, label: '8.5 × 11 in', inches: '8.5x11' }
}
export const PRINT_DPI = 300
const QR_SIZE = 900
const QR_Y = 360
const QR_BORDER = 42

const TEAL = '#0E7490'
const PINK = '#E5548C'
const INK = '#1B2530'
const SLATE = '#64748B'
const FONT = '-apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif'

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(img) // a missing logo should not stop the card
    img.src = src
  })

/** Shrinks the font until `text` fits `maxWidth`. */
const fitFont = (ctx: CanvasRenderingContext2D, text: string, weight: number, startPx: number, maxWidth: number) => {
  let px = startPx
  ctx.font = `${weight} ${px}px ${FONT}`
  while (px > 24 && ctx.measureText(text).width > maxWidth) {
    px -= 2
    ctx.font = `${weight} ${px}px ${FONT}`
  }
  return px
}

/**
 * Draws the card. `name` is the line above the logo: a performer's stage name, a venue's business name, or empty for none.
 * Throws if the QR image is empty so the caller can fall back to downloading the plain QR code.
 */
export async function renderQrCard(
  qr: CanvasImageSource & { width: number; height: number },
  stageName: string,
  format: CardFormat = 'card'
): Promise<HTMLCanvasElement> {
  if (!qr.width || !qr.height) throw new Error('QR image is empty or failed to load')

  const { width: pageW, height: pageH } = CARD_FORMATS[format]
  const canvas = document.createElement('canvas')
  canvas.width = pageW
  canvas.height = pageH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  const w = QR_CARD_WIDTH

  // The design is laid out on the 4x6 card (1200 x 1800). A bigger page scales it to fit the page height, centred.
  const scale = pageH / QR_CARD_HEIGHT
  const offsetX = (pageW - QR_CARD_WIDTH * scale) / 2

  // White page, with the header band running edge to edge on a page wider than the card
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, pageW, pageH)
  if (offsetX > 0) {
    ctx.fillStyle = TEAL
    ctx.fillRect(0, 0, pageW, 260 * scale)
    ctx.fillStyle = PINK
    ctx.fillRect(0, 250 * scale, pageW, 10 * scale)
  }
  ctx.save()
  ctx.translate(offsetX, 0)
  ctx.scale(scale, scale)

  // Header: teal band with a pink accent line, a white tile holding the brand music icon, and the title
  const headerH = 260
  ctx.fillStyle = TEAL
  ctx.fillRect(0, 0, w, headerH)
  ctx.fillStyle = PINK
  ctx.fillRect(0, headerH - 10, w, 10)

  const title = 'Tip the performer'
  const tile = 150
  const gap = 40
  const titlePx = fitFont(ctx, title, 800, 112, w - 140 - tile - gap)
  const titleW = ctx.measureText(title).width
  const startX = (w - (tile + gap + titleW)) / 2
  const tileY = (headerH - 10 - tile) / 2
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(startX + tile / 2, tileY + tile / 2, tile / 2, 0, Math.PI * 2)
  ctx.fill()
  drawBrandIcon(ctx, 'music', startX + tile * 0.2, tileY + tile * 0.2, tile * 0.6, { strokeWidth: 1.7 })
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${titlePx}px ${FONT}`
  ctx.fillText(title, startX + tile + gap, (headerH - 10) / 2 + 4)

  // QR code in a rounded teal frame (QR itself unchanged: 900 px)
  const qrX = (w - QR_SIZE) / 2
  const frameX = qrX - QR_BORDER
  const frameY = QR_Y - QR_BORDER
  const frameS = QR_SIZE + QR_BORDER * 2
  ctx.fillStyle = TEAL
  ctx.beginPath()
  ctx.roundRect(frameX, frameY, frameS, frameS, 48)
  ctx.fill()
  // Crisp square modules at any size: no smoothing when the code is enlarged
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(qr, qrX, QR_Y, QR_SIZE, QR_SIZE)
  ctx.imageSmoothingEnabled = true

  // "Scan to tip" pill sitting on the bottom edge of the frame
  const pillW = 470
  const pillH = 92
  const pillX = (w - pillW) / 2
  const pillY = frameY + frameS - pillH / 2 + 12 // clear of the QR's own white margin
  ctx.fillStyle = PINK
  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 46px ${FONT}`
  ctx.fillText('SCAN TO TIP', w / 2, pillY + pillH / 2 + 2)

  // How it works
  ctx.fillStyle = INK
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 46px ${FONT}`
  ctx.fillText('Scan. Choose how to pay. Tap to tip.', w / 2, 1440)

  // Trust line with the brand padlock
  const trust = 'Secure payments powered by Stripe'
  ctx.font = `500 32px ${FONT}`
  const trustW = ctx.measureText(trust).width
  const lock = 38
  const lockGap = 14
  const trustStart = (w - (lock + lockGap + trustW)) / 2
  drawBrandIcon(ctx, 'lock', trustStart, 1480, lock, { tone: 'brand', strokeWidth: 1.8 })
  ctx.fillStyle = SLATE
  ctx.textAlign = 'left'
  ctx.fillText(trust, trustStart + lock + lockGap, 1511)

  // Performer or venue name (left out when there is none)
  if (stageName.trim()) {
    ctx.textAlign = 'center'
    ctx.fillStyle = INK
    fitFont(ctx, stageName, 800, 76, w - 160)
    ctx.fillText(stageName, w / 2, 1606)
  }

  // Tipwave logo, centered at the foot
  const logo = await loadImage('/images/logo/tipwave-logo-v2.png')
  if (logo.complete && logo.naturalHeight > 0) {
    const logoH = 110
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH
    ctx.drawImage(logo, (w - logoW) / 2, 1650, logoW, logoH)
  }

  ctx.restore()
  return canvas
}

// ---- PNG with a print size ---------------------------------------------------------------------------------------------
// A canvas PNG has no size in inches, so a print dialog guesses (usually 72 dpi, far too big). Writing the pixel density into
// the file (the pHYs chunk) makes a 4 x 6 card print 4 x 6 and the letter page print 8.5 x 11.

let crcTable: Uint32Array | null = null
const crc32 = (bytes: Uint8Array) => {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const readBuffer = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

/** Returns the same PNG with its print density set (default 300 dpi). A file that is not a PNG is returned unchanged. */
export async function withPngDpi(png: Blob, dpi = PRINT_DPI): Promise<Blob> {
  const bytes = new Uint8Array(await readBuffer(png))
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 33 || !signature.every((b, i) => bytes[i] === b)) return png

  const ihdrEnd = 8 + 8 + 13 + 4 // signature + chunk header + IHDR data + its CRC
  const perMeter = Math.round(dpi / 0.0254)
  const chunk = new Uint8Array(4 + 4 + 9 + 4)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  view.setUint32(8, perMeter)
  view.setUint32(12, perMeter)
  chunk[16] = 1 // metres
  view.setUint32(17, crc32(chunk.subarray(4, 17)))

  const out = new Uint8Array(bytes.length + chunk.length)
  out.set(bytes.subarray(0, ihdrEnd), 0)
  out.set(chunk, ihdrEnd)
  out.set(bytes.subarray(ihdrEnd), ihdrEnd + chunk.length)
  return new Blob([out], { type: 'image/png' })
}

/** The card as a PNG file with its print size set. */
export async function cardToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not create the card')
  return withPngDpi(blob)
}
