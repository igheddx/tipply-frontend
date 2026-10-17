// Shared device configuration options (light effects, sounds, volume) for the portal.
// Light Effect 4-6 and the sound options apply to Prototype3 devices only.

export const TIP_TIERS = [1, 5, 10, 20, 50, 100]

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
  '1': 'effect1',
  '5': 'effect1',
  '10': 'effect2',
  '20': 'effect2',
  '50': 'effect3',
  '100': 'effect3',
}

// Older saved configs were keyed "2" instead of "1" for the lowest tier; carry that
// value over so the $1 tip uses the effect the performer picked.
export const normalizeEffectConfig = (config: Record<string, string>): Record<string, string> => {
  const normalized = { ...DEFAULT_EFFECT_CONFIG, ...config }
  if (config['1'] === undefined && config['2'] !== undefined) {
    normalized['1'] = config['2']
  }
  delete normalized['2']
  return normalized
}
