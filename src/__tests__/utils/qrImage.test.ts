import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/config', () => ({ API_BASE_URL: 'http://api.test' }))
import { fetchQrPng } from '@/utils/qrImage'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const BASE64_PNG = btoa(String.fromCharCode(...PNG))

const respond = (body: BlobPart, ok = true, status = 200, type = 'image/png') => {
  global.fetch = vi.fn().mockResolvedValue({ ok, status, blob: async () => new Blob([body], { type }) }) as any
}

describe('QR image loading', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns a real PNG as it is, asking for an image', async () => {
    respond(PNG)
    const png = await fetchQrPng('d1')
    expect(png.type).toBe('image/png')
    expect(png.size).toBe(PNG.length)
    const [url, init] = (global.fetch as any).mock.calls[0]
    expect(url).toBe('http://api.test/api/devices/d1/qr')
    expect(init.headers.Accept).toBe('image/png')
  })

  it('turns base64 text (what the gateway sometimes returns) back into a PNG', async () => {
    respond(BASE64_PNG, true, 200, 'text/plain')
    const png = await fetchQrPng('d1')
    expect(png.type).toBe('image/png')
    expect(png.size).toBe(PNG.length)
    expect(png.type).toBe('image/png')
  })

  it('asks for a performer\'s own code with their id', async () => {
    respond(PNG)
    await fetchQrPng('d1', 'p 1')
    expect((global.fetch as any).mock.calls[0][0]).toBe('http://api.test/api/devices/d1/qr?performerId=p%201')
  })

  it('says so plainly when the server fails or sends something else', async () => {
    respond('{}', false, 404, 'application/json')
    await expect(fetchQrPng('d1')).rejects.toThrow('could not be loaded (404)')
    respond('<html>nope</html>', true, 200, 'text/html')
    await expect(fetchQrPng('d1')).rejects.toThrow('format this browser cannot show')
  })
})
