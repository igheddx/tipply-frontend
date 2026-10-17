// Shared device configuration options (light effects, sounds, volume) for the portal.
// Light Effect 4-6 and the sound options apply to Prototype3 devices only.

export const TIP_TIERS = [2, 5, 10, 20, 50, 100] // $2 is the minimum tip

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

// Configs created by the database default (or an earlier build of this screen) key the
// lowest tier "1"; carry that value over to "2" so the $2 tip uses the effect the performer picked.
export const normalizeEffectConfig = (config: Record<string, string>): Record<string, string> => {
  const normalized = { ...DEFAULT_EFFECT_CONFIG, ...config }
  if (config['2'] === undefined && config['1'] !== undefined) {
    normalized['2'] = config['1']
  }
  delete normalized['1']
  return normalized
}
