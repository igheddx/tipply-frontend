/**
 * The "new tip" sound for the Live tab: a soft three-note ripple, made in the browser (there is no audio file).
 * Browsers only allow sound after the person has touched the page, so call `unlockTipChime` from a tap or click;
 * until then `playTipChime` quietly does nothing.
 */

let ctx: AudioContext | null = null

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
    return c.state === 'running'
  } catch {
    return false
  }
}

export const isTipChimeReady = () => ctx?.state === 'running'

/** Plays the ripple. Never throws. Returns false if the browser is not allowing sound yet. */
export function playTipChime(): boolean {
  try {
    const c = create()
    if (!c || c.state !== 'running') return false

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
