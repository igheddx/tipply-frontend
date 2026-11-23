import { apiService } from './api'

export const payoutApi = {
  /**
   * A one-time link into the signed-in performer's own Stripe dashboard (balance, withdraw, payout schedule). It is for the performer who is
   * signed in: no id is sent, the server takes it from the sign-in. The link expires within minutes and works once.
   */
  dashboardLink: () => apiService.post('/api/payouts/dashboard-link', {})
}
