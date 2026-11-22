import { apiService } from './api'

export type PlatformKey = 'ios' | 'android' | 'desktop' | 'unknown'

export interface PlatformRow {
  key: PlatformKey
  tippers: number
  tips: number
  totalAmount: number
  /** Tippers who pay with Apple Pay or Google Pay */
  walletTippers: number
  /** Tippers who asked for a song at least once, and how many requests that was */
  songRequesters: number
  songRequests: number
}

/** The people who tip, by phone. Counts and totals only. `days` 0 is all time. */
export interface PlatformMix {
  days: number
  tippers: number
  rows: PlatformRow[]
}

export const platformMixApi = {
  admin: (days: number) => apiService.get(`/api/admin/platform-mix?days=${days}`)
}
