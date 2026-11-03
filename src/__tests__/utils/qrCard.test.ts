import { describe, it, expect } from 'vitest'
import { withPngDpi, CARD_FORMATS, PRINT_DPI } from '@/utils/qrCard'

// A tiny real 1x1 PNG
const PNG_1X1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))

const bytesOf = (blob: Blob) =>
  new Promise<Uint8Array>(resolve => {
    const r = new FileReader()
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer))
    r.readAsArrayBuffer(blob)
  })

describe('print sizes', () => {
  it('has a 4 x 6 card and a US Letter page, both at 300 dpi', () => {
    expect(PRINT_DPI).toBe(300)
    expect(CARD_FORMATS.card).toMatchObject({ width: 4 * 300, height: 6 * 300 })
    expect(CARD_FORMATS.letter).toMatchObject({ width: 8.5 * 300, height: 11 * 300 })
  })

  it('the letter page is tall enough for the card and leaves room on both sides', () => {
    const scale = CARD_FORMATS.letter.height / CARD_FORMATS.card.height
    expect(CARD_FORMATS.card.width * scale).toBeLessThan(CARD_FORMATS.letter.width)
  })
})

describe('writing the print density into a PNG', () => {
  it('adds a pHYs chunk right after the header with 300 dpi', async () => {
    const out = await bytesOf(await withPngDpi(new Blob([PNG_1X1], { type: 'image/png' }), 300))
    const view = new DataView(out.buffer)
    const at = 33 // signature (8) + IHDR chunk (25)
    expect(view.getUint32(at)).toBe(9)
    expect(String.fromCharCode(...out.slice(at + 4, at + 8))).toBe('pHYs')
    expect(view.getUint32(at + 8)).toBe(11811) // pixels per metre at 300 dpi
    expect(view.getUint32(at + 12)).toBe(11811)
    expect(out[at + 16]).toBe(1)
    expect(out.length).toBe(PNG_1X1.length + 21)
  })

  it('writes a correct checksum, so viewers and printers accept the file', async () => {
    const out = await bytesOf(await withPngDpi(new Blob([PNG_1X1]), 300))
    const view = new DataView(out.buffer)
    const crcOf = (bytes: Uint8Array) => {
      let crc = 0xffffffff
      for (const b of bytes) {
        crc ^= b
        for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
      }
      return (crc ^ 0xffffffff) >>> 0
    }
    expect(view.getUint32(33 + 17)).toBe(crcOf(out.slice(33 + 4, 33 + 17)))
  })

  it('leaves everything after the header untouched', async () => {
    const out = await bytesOf(await withPngDpi(new Blob([PNG_1X1])))
    expect(Array.from(out.slice(0, 33))).toEqual(Array.from(PNG_1X1.slice(0, 33)))
    expect(Array.from(out.slice(33 + 21))).toEqual(Array.from(PNG_1X1.slice(33)))
  })

  it('returns something that is not a PNG unchanged', async () => {
    const text = new Blob(['not a png at all, just text that is long enough to pass'], { type: 'text/plain' })
    expect(await withPngDpi(text)).toBe(text)
  })
})
