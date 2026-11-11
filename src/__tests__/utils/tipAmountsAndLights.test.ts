import { describe, it, expect } from 'vitest'
import {
  ALLOWED_TIP_AMOUNTS,
  DEFAULT_TIP_AMOUNTS,
  defaultEffectConfigFor,
  effectForAmount,
  normalizeEffectConfig,
  remapEffectConfigByPosition,
  validateTipAmounts,
} from '../../utils/deviceConfig'

const OLD_PATTERN = { '2': 'effect1', '5': 'effect1', '10': 'effect2', '20': 'effect2', '50': 'effect3', '100': 'effect3' }

describe('tip amounts', () => {
  it('defaults to 5, 10, 15, 20, 50, 100, all in the allowed list', () => {
    expect(DEFAULT_TIP_AMOUNTS).toEqual([5, 10, 15, 20, 50, 100])
    DEFAULT_TIP_AMOUNTS.forEach(a => expect(ALLOWED_TIP_AMOUNTS).toContain(a))
  })

  it('offers the sixteen amounts from $2 to $100', () => {
    expect(ALLOWED_TIP_AMOUNTS).toEqual([2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100])
  })

  it('accepts exactly six different amounts from the list', () => {
    expect(validateTipAmounts([5, 10, 15, 20, 50, 100])).toBeNull()
    expect(validateTipAmounts([100, 2, 50, 5, 25, 10])).toBeNull()
  })

  it('rejects five, seven, repeats and amounts outside the list', () => {
    expect(validateTipAmounts([5, 10, 15, 20, 50])).not.toBeNull()
    expect(validateTipAmounts([5, 10, 15, 20, 50, 100, 90])).not.toBeNull()
    expect(validateTipAmounts([5, 10, 15, 20, 50, 50])).not.toBeNull()
    expect(validateTipAmounts([5, 10, 15, 20, 50, 55])).not.toBeNull()
    expect(validateTipAmounts([5, 10, 15, 20, 50, 500])).not.toBeNull()
  })
})

describe('lights follow the position', () => {
  it('the default is Flash, Swirl, Breathing, then effects 4 to 6, left to right', () => {
    expect(defaultEffectConfigFor(DEFAULT_TIP_AMOUNTS)).toEqual({
      '5': 'effect1', '10': 'effect2', '15': 'effect3', '20': 'effect4', '50': 'effect5', '100': 'effect6',
    })
  })

  it('a device still on the old default moves to the new default for the performer\'s amounts', () => {
    expect(normalizeEffectConfig(OLD_PATTERN, DEFAULT_TIP_AMOUNTS)).toEqual(defaultEffectConfigFor(DEFAULT_TIP_AMOUNTS))
    expect(normalizeEffectConfig({}, DEFAULT_TIP_AMOUNTS)).toEqual(defaultEffectConfigFor(DEFAULT_TIP_AMOUNTS))
  })

  it('a light the performer changed is kept', () => {
    const custom = { ...OLD_PATTERN, '2': 'effect6' }
    expect(normalizeEffectConfig(custom, DEFAULT_TIP_AMOUNTS)).toEqual(custom)
  })

  it('changing an amount keeps the light of its position', () => {
    const before = defaultEffectConfigFor([5, 10, 15, 20, 50, 100])
    expect(remapEffectConfigByPosition(before, [5, 10, 15, 20, 50, 100], [5, 10, 20, 25, 50, 90])).toEqual({
      '5': 'effect1', '10': 'effect2', '20': 'effect3', '25': 'effect4', '50': 'effect5', '90': 'effect6',
    })
  })

  it('a performer\'s own light choice for a position survives an amount change', () => {
    const swapped = { '5': 'effect6', '10': 'effect2', '15': 'effect3', '20': 'effect4', '50': 'effect5', '100': 'effect1' }
    expect(remapEffectConfigByPosition(swapped, [5, 10, 15, 20, 50, 100], [2, 10, 15, 20, 50, 100])).toEqual({
      '2': 'effect6', '10': 'effect2', '15': 'effect3', '20': 'effect4', '50': 'effect5', '100': 'effect1',
    })
  })

  it('an amount with no setting uses the nearest lower amount, else the first effect', () => {
    const config = { '5': 'effect1', '10': 'effect2', '20': 'effect4' }
    expect(effectForAmount(config, 15)).toBe('effect2')
    expect(effectForAmount(config, 3)).toBe('effect1')
  })
})
