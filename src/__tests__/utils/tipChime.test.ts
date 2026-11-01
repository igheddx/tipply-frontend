import { describe, it, expect, vi, beforeEach } from 'vitest'

// A tiny fake of the browser's audio so the chime logic can run in jsdom
const makeAudio = () => {
  const started: string[] = []
  const ctx = {
    state: 'suspended' as 'suspended' | 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async function (this: any) { ctx.state = 'running' }),
    decodeAudioData: vi.fn(async () => ({ fake: 'ripple' })),
    createGain: () => ({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createDelay: () => ({ delayTime: { value: 0 }, connect() {} }),
    createBufferSource: () => ({ buffer: null, connect() {}, start: () => started.push('file') }),
    createOscillator: () => ({ type: '', frequency: { value: 0 }, connect() {}, start: () => started.push('synth'), stop() {} })
  }
  return { ctx, started }
}

describe('tip chime', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('stays silent until the browser allows sound', async () => {
    const { ctx } = makeAudio()
    ;(window as any).AudioContext = function () { return ctx }
    global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as any
    const chime = await import('../../utils/tipChime')
    expect(chime.playTipChime()).toBe(false)
  })

  it('plays the Ripple file once it is loaded, after a tap unlocks sound', async () => {
    const { ctx, started } = makeAudio()
    ;(window as any).AudioContext = function () { return ctx }
    global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as any
    const chime = await import('../../utils/tipChime')

    expect(await chime.unlockTipChime()).toBe(true)
    await new Promise(r => setTimeout(r, 0)) // let the file finish loading
    expect(global.fetch).toHaveBeenCalledWith(chime.RIPPLE_URL)
    expect(chime.playTipChime()).toBe(true)
    expect(started).toEqual(['file'])
  })

  it('falls back to the browser-made ripple if the file cannot be loaded', async () => {
    const { ctx, started } = makeAudio()
    ;(window as any).AudioContext = function () { return ctx }
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as any
    const chime = await import('../../utils/tipChime')

    await chime.unlockTipChime()
    await new Promise(r => setTimeout(r, 0))
    expect(chime.playTipChime()).toBe(true)
    expect(started).toEqual(['synth', 'synth', 'synth'])
  })
})
