import { drawBrandIcon } from '../components/icons/BrandIcons'

/**
 * The printable 4x6 in card (1200 x 1800 px, 300 dpi) a performer puts next to their device: the QR code in a
 * Tipwave-teal frame, a short how-to, the performer's name and the Tipwave logo. The QR code itself is
 * drawn at a fixed 900 px so it scans the same as before.
 */
export const QR_CARD_WIDTH = 1200
export const QR_CARD_HEIGHT = 1800
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

/** Throws if the QR image is empty so the caller can fall back to downloading the plain QR code. */
export async function renderQrCard(qr: CanvasImageSource & { width: number; height: number }, stageName: string): Promise<HTMLCanvasElement> {
  if (!qr.width || !qr.height) throw new Error('QR image is empty or failed to load')

  const canvas = document.createElement('canvas')
  canvas.width = QR_CARD_WIDTH
  canvas.height = QR_CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  const w = QR_CARD_WIDTH

  // White card for print efficiency
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, QR_CARD_HEIGHT)

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
  ctx.drawImage(qr, qrX, QR_Y, QR_SIZE, QR_SIZE)

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

  // Performer name
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  fitFont(ctx, stageName, 800, 76, w - 160)
  ctx.fillText(stageName, w / 2, 1606)

  // Tipwave logo, centered at the foot
  const logo = await loadImage('/images/logo/tipwave-logo-v2.png')
  if (logo.complete && logo.naturalHeight > 0) {
    const logoH = 110
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH
    ctx.drawImage(logo, (w - logoW) / 2, 1650, logoW, logoH)
  }

  return canvas
}
