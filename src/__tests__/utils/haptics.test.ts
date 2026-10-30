import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tipHaptic, hapticLevelFor, resetHapticsForTests, VIBRATION_PATTERNS } from '../../utils/haptics'

const setNavigator = (props: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true })
  }
}

describe('tip haptics', () => {
  afterEach(() => {
    resetHapticsForTests()
    vi.useRealTimers()
    // @ts-expect-error clean up the fake
    delete (navigator as any).vibrate
  })

  it('gets stronger as the tip gets bigger', () => {
    expect([1, 2, 5, 10, 20, 50, 100].map(hapticLevelFor)).toEqual([1, 1, 2, 2, 3, 4, 4])
    const total = (a: number[]) => a.reduce((x, y) => x + y, 0)
    expect(total(VIBRATION_PATTERNS[4])).toBeGreaterThan(total(VIBRATION_PATTERNS[3]))
    expect(total(VIBRATION_PATTERNS[3])).toBeGreaterThan(total(VIBRATION_PATTERNS[2]))
    expect(total(VIBRATION_PATTERNS[2])).toBeGreaterThan(total(VIBRATION_PATTERNS[1]))
  })

  describe('Android (Vibration API)', () => {
    it('vibrates with the pattern for the tip size', () => {
      const vibrate = vi.fn()
      setNavigator({ vibrate })
      tipHaptic(20)
      expect(vibrate).toHaveBeenCalledWith(VIBRATION_PATTERNS[3])
    })

    it('does not throw if vibrate fails', () => {
      setNavigator({ vibrate: () => { throw new Error('blocked') } })
      expect(() => tipHaptic(5)).not.toThrow()
    })
  })

  describe('iPhone (switch tick)', () => {
    beforeEach(() => {
      setNavigator({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' })
      vi.useFakeTimers()
    })

    it('toggles a hidden switch several times, more for a bigger tip', () => {
      let changes = 0
      tipHaptic(1) // creates the switch
      vi.runAllTimers()
      const input = document.querySelector('input[type="checkbox"][switch]') as HTMLInputElement
      expect(input).not.toBeNull()
      input.addEventListener('change', () => changes++)

      changes = 0
      tipHaptic(1)
      vi.runAllTimers()
      const small = changes

      changes = 0
      tipHaptic(100)
      vi.runAllTimers()
      expect(small).toBe(2)
      expect(changes).toBe(6)
    })

    it('keeps the hidden switch out of sight and out of the way', () => {
      tipHaptic(5)
      const label = document.querySelector('label[aria-hidden="true"]') as HTMLElement
      expect(label.style.pointerEvents).toBe('none')
      expect(label.style.opacity).toBe('0')
    })

    it('uses only one switch no matter how many taps', () => {
      tipHaptic(5)
      tipHaptic(5)
      tipHaptic(5)
      expect(document.querySelectorAll('input[switch]').length).toBe(1)
    })
  })

  it('does nothing on a desktop browser with no haptics', () => {
    setNavigator({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36' })
    expect(() => tipHaptic(100)).not.toThrow()
    expect(document.querySelector('input[switch]')).toBeNull()
  })
})
