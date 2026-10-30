/**
 * Haptic feedback for the tip button, on both Android and iPhone/iPad.
 *
 * - Android (Chrome, Firefox, Edge): the Vibration API. A motor cannot be told how hard to buzz, so "stronger" is
 *   made from longer, repeated pulses.
 * - iPhone and iPad (Safari, and Chrome on iOS, which is Safari underneath): iOS has no Vibration API. Safari 17.4+
 *   does tick the Taptic Engine when a hidden `<input type="checkbox" switch>` is toggled, so we toggle one in a short
 *   run of ticks. This only works inside a tap, so call `tipHaptic` straight from the click handler.
 *
 * Both calls are best effort: a phone on silent/low power mode, or an older iOS, simply does nothing.
 */

export type HapticLevel = 1 | 2 | 3 | 4

/** Bigger tips feel bigger. Matches the confetti tiers. */
export const hapticLevelFor = (amount: number): HapticLevel => (amount >= 50 ? 4 : amount >= 20 ? 3 : amount >= 5 ? 2 : 1)

// Android: vibrate / pause / vibrate ... in milliseconds
export const VIBRATION_PATTERNS: Record<HapticLevel, number[]> = {
  1: [70],
  2: [90, 40, 90],
  3: [110, 40, 110, 40, 130],
  4: [150, 50, 150, 50, 180, 50, 240]
}

// iPhone: number of taps in the run, and the gap between them
const TICKS: Record<HapticLevel, number> = { 1: 2, 2: 3, 3: 4, 4: 6 }
const TICK_GAP_MS = 65

let switchLabel: HTMLLabelElement | null = null

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** Adds the hidden switch once. Call it when the page loads so it is ready before the first tap. */
export function prepareHaptics() {
  if (switchLabel || typeof document === 'undefined' || !isIOS()) return
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  switchLabel = label
}

/** Fires the haptic for a tip of `amount` dollars. Safe to call anywhere; never throws. */
export function tipHaptic(amount: number) {
  try {
    const level = hapticLevelFor(amount)

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(VIBRATION_PATTERNS[level])
      return
    }

    if (isIOS()) {
      prepareHaptics()
      const label = switchLabel
      if (!label) return
      // First tick right away (inside the tap), the rest shortly after
      label.click()
      for (let i = 1; i < TICKS[level]; i++) setTimeout(() => label.click(), i * TICK_GAP_MS)
    }
  } catch {
    // Haptics are a nicety; never get in the way of a tip
  }
}

/** Test helper: forget the hidden switch so a fresh one is made. */
export function resetHapticsForTests() {
  switchLabel?.remove()
  switchLabel = null
}
