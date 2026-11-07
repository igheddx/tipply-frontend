import { apiService } from './api'
import { getApiBaseUrl } from '../utils/config'

export interface RefundNotice {
  id: string
  amount: number
  refundedAt: string
  /** Who was tipped. Only sent to the tipper. */
  performerName?: string | null
}

export interface RefundNoticeList {
  notices: RefundNotice[]
  totalAmount: number
}

const empty: RefundNoticeList = { notices: [], totalAmount: 0 }

export const refundNoticeApi = {
  /** The tipper has no account; their browser's anonymous id finds their notices. Never throws: a notice is a courtesy. */
  async forTipper(userId: string): Promise<RefundNoticeList> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/refund-notices/tipper/${encodeURIComponent(userId)}`, { cache: 'no-store' })
      if (!res.ok) return empty
      const data = await res.json()
      return Array.isArray(data?.notices) ? data : empty
    } catch {
      return empty
    }
  },

  async tipperSeen(userId: string, ids: string[]): Promise<void> {
    try {
      await fetch(`${getApiBaseUrl()}/api/refund-notices/tipper/${encodeURIComponent(userId)}/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })
    } catch {
      // It will simply be offered again next visit
    }
  },

  async forPerformer(): Promise<RefundNoticeList> {
    const res = await apiService.get('/api/refund-notices/mine')
    return Array.isArray(res.data?.notices) ? res.data : empty
  },

  performerSeen: (ids: string[]) => apiService.post('/api/refund-notices/mine/seen', { ids })
}
