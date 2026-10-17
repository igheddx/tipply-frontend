// Shared device configuration options (light effects, sounds, volume) for the portal.
// Light Effect 4-6 and the sound options apply to Prototype3 devices only.

// Tip amounts every performer starts with; each performer can change them (six amounts, whole dollars)
export const DEFAULT_TIP_AMOUNTS = [2, 5, 10, 20, 50, 100]
export const TIP_AMOUNT_COUNT = 6
export const MIN_TIP_AMOUNT = 2 // no $1 tips
export const MAX_TIP_AMOUNT = 500

// Returns an error message when the amounts are not a valid set of six, otherwise null
export const validateTipAmounts = (amounts: number[]): string | null => {
  if (amounts.length !== TIP_AMOUNT_COUNT) return `Exactly ${TIP_AMOUNT_COUNT} tip amounts are required`
  if (amounts.some(a => !Number.isInteger(a) || a < MIN_TIP_AMOUNT || a > MAX_TIP_AMOUNT)) {
    return `Each amount must be a whole dollar amount between $${MIN_TIP_AMOUNT} and $${MAX_TIP_AMOUNT}`
  }
  for (let i = 1; i < amounts.length; i++) {
    if (amounts[i] <= amounts[i - 1]) return 'Amounts must be unique and in ascending order'
  }
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
export const DEFAULT_SOUND_VOLUME = 'medium'

export const DEFAULT_EFFECT_CONFIG: Record<string, string> = {
  '2': 'effect1',
  '5': 'effect1',
  '10': 'effect2',
  '20': 'effect2',
  '50': 'effect3',
  '100': 'effect3',
}

// Effect for a tip amount: the exact setting, else the nearest lower amount that has a setting
// (matches the backend), else the default by size.
export const effectForAmount = (config: Record<string, string>, amount: number): string => {
  if (config[amount.toString()]) return config[amount.toString()]
  const lower = Object.keys(config)
    .map(Number)
    .filter(n => Number.isFinite(n) && n <= amount)
    .sort((a, b) => b - a)[0]
  if (lower !== undefined) return config[lower.toString()]
  return amount >= 50 ? 'effect3' : amount >= 10 ? 'effect2' : 'effect1'
}

// One explicit effect per current tip amount; drops settings for amounts the performer no longer offers
export const buildEffectConfig = (config: Record<string, string>, amounts: number[]): Record<string, string> =>
  Object.fromEntries(amounts.map(amount => [amount.toString(), effectForAmount(config, amount)]))

// The database default (and an earlier build of this screen) keyed the lowest tier "1";
// carry that choice over to "2", since $2 is the minimum tip.
export const normalizeEffectConfig = (config: Record<string, string>): Record<string, string> => {
  const normalized = { ...config }
  if (normalized['2'] === undefined && normalized['1'] !== undefined) {
    normalized['2'] = normalized['1']
  }
  delete normalized['1']
  return normalized
}
