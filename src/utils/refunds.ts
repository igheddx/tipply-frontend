export interface RefundEligibilityInput {
  status: string
  createdAt: string
  stripePaymentIntentId?: string | null
}

export const isRefundEligible = (tip: RefundEligibilityInput): boolean => {
  if (tip.status !== 'processed') return false
  if (!tip.stripePaymentIntentId) return false

  const createdAt = new Date(tip.createdAt)
  if (Number.isNaN(createdAt.getTime())) return false

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return createdAt >= sevenDaysAgo
}
