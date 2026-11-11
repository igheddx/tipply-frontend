// Shared device configuration options (light effects, sounds, volume) for the portal.
// Light Effect 4-6 and the sound options apply to Prototype3 devices only.

// Tip amounts every performer starts with; each performer picks six from ALLOWED_TIP_AMOUNTS (whole dollars, shown smallest to largest)
export const DEFAULT_TIP_AMOUNTS = [5, 10, 15, 20, 50, 100]
export const ALLOWED_TIP_AMOUNTS = [2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100]
export const TIP_AMOUNT_COUNT = 6
export const MIN_TIP_AMOUNT = 2 // no $1 tips
export const MAX_TIP_AMOUNT = 500

// Returns an error message when the amounts are not a valid choice of six, otherwise null
export const validateTipAmounts = (amounts: number[]): string | null => {
  if (amounts.length !== TIP_AMOUNT_COUNT) return `Pick exactly ${TIP_AMOUNT_COUNT} tip amounts`
  if (amounts.some(a => !ALLOWED_TIP_AMOUNTS.includes(a))) return 'Pick amounts from the list'
  if (new Set(amounts).size !== amounts.length) return 'Tip amounts must be different from each other'
  return null
}

export const LIGHT_EFFECTS: { value: string; label: string }[] = [
  { value: 'effect1', label: 'Flash' },
  { value: 'effect2', label: 'Swirl' },
  { value: 'effect3', label: 'Breathing' },
  { value: 'effect4', label: 'Light Effect 4' },
  { value: 'effect5', label: 'Light Effect 5' },
  { value: 'effect6', label: 'Light Effect 6' },
]

export const SOUND_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Cash Register' },
  { value: 2, label: 'Ripple' },
  { value: 3, label: 'Spark' },
]

export const VOLUME_OPTIONS: { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export const DEFAULT_SOUND_ID = 1
export const DEFAULT_SOUND_VOLUME = 'low'

// One light per position, smallest amount to largest: Flash, Swirl, Breathing, then Light Effects 4 to 6.
// The light belongs to the position, not to the dollar value.
export const EFFECT_BY_POSITION = LIGHT_EFFECTS.map(effect => effect.value)

export const defaultEffectConfigFor = (amounts: number[]): Record<string, string> =>
  Object.fromEntries(amounts.map((amount, i) => [amount.toString(), EFFECT_BY_POSITION[Math.min(i, EFFECT_BY_POSITION.length - 1)]]))

export const DEFAULT_EFFECT_CONFIG: Record<string, string> = defaultEffectConfigFor(DEFAULT_TIP_AMOUNTS)

// The settings every device had before the six-effect default (two amounts per effect). A device still exactly on this
// (or on the older key "1") was never customised, so it moves to the new default.
const OLD_DEFAULT_PATTERNS: Record<string, string>[] = [
  { '2': 'effect1', '5': 'effect1', '10': 'effect2', '20': 'effect2', '50': 'effect3', '100': 'effect3' },
  { '1': 'effect1', '5': 'effect1', '10': 'effect2', '20': 'effect2', '50': 'effect3', '100': 'effect3' },
]

const sameMap = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key])
}

// Effect for a tip amount: the exact setting, else the nearest lower amount that has a setting
// (matches the backend), else the first effect.
export const effectForAmount = (config: Record<string, string>, amount: number): string => {
  if (config[amount.toString()]) return config[amount.toString()]
  const lower = Object.keys(config)
    .map(Number)
    .filter(n => Number.isFinite(n) && n <= amount)
    .sort((a, b) => b - a)[0]
  if (lower !== undefined) return config[lower.toString()]
  return 'effect1'
}

// One explicit effect per current tip amount; drops settings for amounts the performer no longer offers
export const buildEffectConfig = (config: Record<string, string>, amounts: number[]): Record<string, string> =>
  Object.fromEntries(amounts.map(amount => [amount.toString(), effectForAmount(config, amount)]))

// A device that was never customised gets the six-effect default for the performer's amounts; anything the performer
// changed is kept. (The old key "1" is carried over to "2" because $2 is the minimum tip.)
export const normalizeEffectConfig = (config: Record<string, string>, amounts: number[] = DEFAULT_TIP_AMOUNTS): Record<string, string> => {
  if (Object.keys(config).length === 0 || OLD_DEFAULT_PATTERNS.some(pattern => sameMap(config, pattern))) {
    return defaultEffectConfigFor(amounts)
  }
  const normalized = { ...config }
  if (normalized['2'] === undefined && normalized['1'] !== undefined) {
    normalized['2'] = normalized['1']
  }
  delete normalized['1']
  return normalized
}

// The performer changed their amounts: each position keeps the light it had, now keyed by its new amount
// (mirrors the server, which saves the same result for the performer's devices)
export const remapEffectConfigByPosition = (config: Record<string, string>, oldAmounts: number[], newAmounts: number[]): Record<string, string> => {
  const current = normalizeEffectConfig(config, oldAmounts)
  return Object.fromEntries(newAmounts.map((amount, i) => [amount.toString(), effectForAmount(current, i < oldAmounts.length ? oldAmounts[i] : amount)]))
}
