import { apiService } from './api'

export interface TipperOtherTip {
  tipId: string
  createdAt: string
  amount: number
  status: string
}

/** Admin only. The ids and the email always travel together. Performers never see any of this. */
export interface TipperDetails {
  tipId: string
  userId: string
  browserId?: string | null
  email?: string | null
  cardBrand?: string | null
  cardLast4?: string | null
  wallet?: string | null
  /** ok, mode_mismatch, unavailable or no_payment_method */
  stripeStatus: string
  otherTips: TipperOtherTip[]
}

export const tipperApi = {
  details: (tipId: string) => apiService.get(`/api/admin/tips/${tipId}/tipper`)
}
