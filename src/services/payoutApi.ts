import { apiService } from './api'

/** What a performer could withdraw right now, and whether they can. `status` says which (see WithdrawStatus). */
export interface WithdrawalPreview {
  status: WithdrawStatus
  available: number
  pending: number
  bankName?: string | null
  bankLast4?: string | null
  arrival?: string
}

export type WithdrawStatus = 'ready' | 'nothing_available' | 'automatic' | 'no_bank' | 'not_ready' | 'unavailable'

export const payoutApi = {
  /**
   * A one-time link into the signed-in performer's own Stripe dashboard (balance, withdraw, payout schedule). It is for the performer who is
   * signed in: no id is sent, the server takes it from the sign-in. The link expires within minutes and works once.
   */
  dashboardLink: () => apiService.post('/api/payouts/dashboard-link', {}),

  /** Read-only: what would be withdrawn and where it would go. Sends nothing. */
  withdrawalPreview: () => apiService.get('/api/payouts/withdraw/preview'),

  /**
   * Sends the whole available balance to the performer's bank, if it is still exactly `amount`, the figure they confirmed. `key` is made once for
   * a confirmation and reused if the same confirmation is retried, so a double tap or a retry cannot send twice. For the signed-in performer only.
   */
  withdraw: (amount: number, key: string) => apiService.post('/api/payouts/withdraw', { amount, key })
}
