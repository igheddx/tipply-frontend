import { apiService } from './api'

export type PlatformKey = 'ios' | 'android' | 'desktop' | 'unknown'

export interface PlatformRow {
  key: PlatformKey
  tippers: number
  tips: number
  totalAmount: number
  /** Tippers who pay with Apple Pay or Google Pay, and their tips */
  walletTippers: number
  walletTips: number
  walletAmount: number
  /** Tippers who asked for a song at least once, and how many requests that was */
  songRequesters: number
  songRequests: number
}

/** One way of paying: Apple Pay or Google Pay, or a typed-in card */
export interface PaymentWay {
  tippers: number
  tips: number
  totalAmount: number
}

/**
 * The people who tip, by phone, and by how they pay. Counts and totals only. `days` 0 is all time. A tipper's tips all count under the way they
 * paid most recently, because the app saves how a person pays, not how each tip was paid.
 */
export interface PlatformMix {
  days: number
  tippers: number
  rows: PlatformRow[]
  wallet?: PaymentWay
  card?: PaymentWay
}

export const platformMixApi = {
  admin: (days: number) => apiService.get(`/api/admin/platform-mix?days=${days}`)
}
