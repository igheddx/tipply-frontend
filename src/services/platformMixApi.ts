import { apiService } from './api'

export type PlatformKey = 'ios' | 'android' | 'desktop' | 'unknown'

export interface PlatformRow {
  key: PlatformKey
  tippers: number
  tips: number
  totalAmount: number
  /** Tippers who paid with Apple Pay or Google Pay at least once, and the tips paid that way */
  walletTippers: number
  walletTips: number
  walletAmount: number
  /** Tippers who asked for a song at least once, and how many requests that was */
  songRequesters: number
  songRequests: number
}

/** One way of paying: Apple Pay or Google Pay, or a typed-in card. A tipper who used both is counted under each. */
export interface PaymentWay {
  tippers: number
  tips: number
  totalAmount: number
}

/** Of the tippers whose phone was checked for a wallet, how many could have used one and whether they did */
export interface WalletReach {
  known: number
  available: number
  usedWallet: number
  typedCardInstead: number
}

/**
 * The people who tip, by phone and by how they pay: counts and totals only. `days` 0 is all time (and always 0 for one show).
 * `estimatedTips` is how many of the tips predate the record of how each tip was paid, so they count under the way that tipper pays now.
 */
export interface PlatformMix {
  days: number
  tippers: number
  rows: PlatformRow[]
  wallet?: PaymentWay
  card?: PaymentWay
  estimatedTips?: number
  walletReach?: WalletReach
}

export const platformMixApi = {
  admin: (days: number) => apiService.get(`/api/admin/platform-mix?days=${days}`),
  show: (profileId: string, showId: string) => apiService.get(`/api/admin/performers/${profileId}/shows/${showId}/platform-mix`)
}
