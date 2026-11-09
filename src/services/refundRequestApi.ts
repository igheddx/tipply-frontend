import { apiService } from './api'

export interface RefundRequest {
  id: string
  tipId: string
  amount: number
  /** When the tip was given */
  tipAt: string
  reason: string
  note?: string | null
  /** pending, approved or declined */
  status: 'pending' | 'approved' | 'declined'
  requestedAt: string
  declineReason?: string | null
}

export interface AdminRefundRequest extends RefundRequest {
  profileId: string
  performerName: string
  tipStatus: string
  hasSongRequest: boolean
  decidedAt?: string | null
  /** Our id for the tipper (admin only) */
  tipperUserId?: string
}

/** A refund an admin made straight from the Tips tab, with no request behind it */
export interface AdminDirectRefund {
  tipId: string
  profileId: string
  performerName: string
  amount: number
  tipAt: string
  refundedAt: string
  hasSongRequest: boolean
}

export interface RefundReason {
  key: string
  label: string
}

/** The same list the server accepts. The server is asked for it too, so the two cannot drift apart. */
export const DEFAULT_REFUND_REASONS: RefundReason[] = [
  { key: 'mistake', label: 'The tipper tapped by mistake' },
  { key: 'asked', label: 'The tipper asked for it back' },
  { key: 'wrong_amount', label: 'Wrong amount' },
  { key: 'other', label: 'Something else' }
]

export const REFUND_WINDOW_DAYS = 7

export const refundRequestApi = {
  create: (body: { tipId?: string; songRequestId?: string; reason: string; note?: string; appVersion?: string }) => apiService.post('/api/refund-requests', body),
  mine: () => apiService.get('/api/refund-requests/mine'),
  mineSeen: (ids: string[]) => apiService.post('/api/refund-requests/mine/seen', { ids }),

  // Admin
  adminList: (pendingOnly = false) => apiService.get(`/api/admin/refund-requests?pendingOnly=${pendingOnly}`),
  approve: (id: string) => apiService.post(`/api/admin/refund-requests/${id}/approve`),
  decline: (id: string, reason?: string) => apiService.post(`/api/admin/refund-requests/${id}/decline`, { reason })
}
