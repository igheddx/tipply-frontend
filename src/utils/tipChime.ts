/**
 * The "new tip" sound for the Live tab: the Tipwave "Ripple" (sound 2), the same one the device plays.
 * Browsers only allow sound after the person has touched the page, so call `unlockTipChime` from a tap or click;
 * until then `playTipChime` quietly does nothing. If the audio file cannot be loaded, a similar soft three-note
 * ripple is made in the browser instead. (Tipwave_Spark_Sound3 is saved in public/sound for later and not used yet.)
 */

export const RIPPLE_URL = '/sound/tipwave-ripple-sound2.wav'

let ctx: AudioContext | null = null
let rippleBuffer: AudioBuffer | null = null
let rippleLoading: Promise<void> | null = null

/** Fetches and decodes the Ripple once. Failure is fine: the synthesized ripple covers it. */
const loadRipple = (c: AudioContext): Promise<void> => {
  if (rippleBuffer) return Promise.resolve()
  if (!rippleLoading) {
    rippleLoading = fetch(RIPPLE_URL)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(data => c.decodeAudioData(data))
      .then(buffer => {
        rippleBuffer = buffer
      })
      .catch(() => {
        rippleLoading = null // try again next time
      })
  }
  return rippleLoading
}

const create = (): AudioContext | null => {
  if (ctx) return ctx
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  } catch {
    ctx = null
  }
  return ctx
}

/** Returns true once the browser lets us make sound. Safe to call again and again. */
export async function unlockTipChime(): Promise<boolean> {
  const c = create()
  if (!c) return false
  try {
    if (c.state === 'suspended') await c.resume()
    void loadRipple(c)
    return c.state === 'running'
  } catch {
    return false
  }
}

export const isTipChimeReady = () => ctx?.state === 'running'

/** Plays the Ripple (or the browser-made one while the file is still loading). Never throws. Returns false if the browser is not allowing sound yet. */
export function playTipChime(): boolean {
  try {
    const c = create()
    if (!c || c.state !== 'running') return false

    if (rippleBuffer) {
      const source = c.createBufferSource()
      source.buffer = rippleBuffer
      const volume = c.createGain()
      volume.gain.value = 1
      source.connect(volume)
      volume.connect(c.destination)
      source.start()
      return true
    }
    void loadRipple(c)

    const master = c.createGain()
    master.gain.value = 0.28
    const echo = c.createDelay(0.5)
    echo.delayTime.value = 0.2
    const echoGain = c.createGain()
    echoGain.gain.value = 0.33
    master.connect(c.destination)
    master.connect(echo)
    echo.connect(echoGain)
    echoGain.connect(c.destination)

    const notes = [783.99, 1046.5, 1318.51] // G5, C6, E6: rising, like rings spreading on water
    const start = c.currentTime + 0.02
    notes.forEach((freq, i) => {
      const t = start + i * 0.12
      const osc = c.createOscillator()
      const env = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      env.gain.setValueAtTime(0.0001, t)
      env.gain.exponentialRampToValueAtTime(1, t + 0.015)
      env.gain.exponentialRampToValueAtTime(0.0001, t + 1.0)
      osc.connect(env)
      env.connect(master)
      osc.start(t)
      osc.stop(t + 1.05)
    })
    return true
  } catch {
    return false
  }
}
