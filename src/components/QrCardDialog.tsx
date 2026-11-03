import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from './ui'
import { fetchQrPng } from '../utils/qrImage'
import { CARD_FORMATS, cardToPng, renderQrCard, type CardFormat } from '../utils/qrCard'

interface QrCardDialogProps {
  open: boolean
  onClose: () => void
  title: string
  deviceId: string
  /** A performer's own card on a venue's device: the code then only takes tips while that performer is on the device */
  performerId?: string
  /** The line on the card above the logo: the performer's stage name, or the venue's name. Empty for none. */
  name: string
  /** Used in the downloaded file's name */
  fileLabel: string
  note?: string
}

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The printable QR card in two sizes: 4 x 6 in and 8.5 x 11 in (US Letter), both at 300 dpi. */
export function QrCardDialog({ open, onClose, title, deviceId, performerId, name, fileLabel, note }: QrCardDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<CardFormat | null>(null)
  const bitmapRef = useRef<ImageBitmap | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let url: string | null = null
    setPreviewUrl(null)
    setFailed(false)
    bitmapRef.current = null
    ;(async () => {
      try {
        const png = await fetchQrPng(deviceId, performerId)
        const bitmap = await createImageBitmap(png)
        const canvas = await renderQrCard(bitmap, name, 'card')
        const blob = await cardToPng(canvas)
        if (cancelled) return
        bitmapRef.current = bitmap
        url = URL.createObjectURL(blob)
        setPreviewUrl(url)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [open, deviceId, performerId, name])

  const download = async (format: CardFormat) => {
    if (!bitmapRef.current) return
    setBusy(format)
    try {
      const canvas = await renderQrCard(bitmapRef.current, name, format)
      saveBlob(await cardToPng(canvas), `tipwave-${fileLabel}-${CARD_FORMATS[format].inches}.png`.replace(/\s+/g, '-'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={!previewUrl} loading={busy === 'card'} onClick={() => download('card')}>
            Download {CARD_FORMATS.card.label}
          </Button>
          <Button variant="secondary" disabled={!previewUrl} loading={busy === 'letter'} onClick={() => download('letter')}>
            Download {CARD_FORMATS.letter.label}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="text-center">
        {previewUrl ? (
          <img src={previewUrl} alt={`QR card for ${title}`} className="mx-auto max-h-[60vh] w-auto rounded-xl border border-slate-200 shadow-card" />
        ) : failed ? (
          <p className="py-16 text-sm text-red-700">The QR card could not be made. Close this and try again.</p>
        ) : (
          <div className="flex h-72 items-center justify-center text-sm text-ink-500">Making your card…</div>
        )}
        {note && <p className="mt-3 text-sm text-ink-500">{note}</p>}
        <p className="mt-1 text-xs text-ink-400">Print at actual size: 4 × 6 in for a table stand, 8.5 × 11 in (US Letter) for a wall or window.</p>
      </div>
    </Modal>
  )
}
