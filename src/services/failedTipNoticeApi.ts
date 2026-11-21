import { getApiBaseUrl } from '../utils/config'

export interface FailedTipNotice {
  id: string
  amount: number
  failedAt: string
  /** Who was tipped */
  performerName?: string | null
}

export interface FailedTipNoticeList {
  notices: FailedTipNotice[]
}

const empty: FailedTipNoticeList = { notices: [] }

export const failedTipNoticeApi = {
  /** A saved-card tip the batch could not charge. The tipper has no account; their browser's anonymous id finds the notices. Never throws: a notice is a courtesy. */
  async forTipper(userId: string): Promise<FailedTipNoticeList> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/failed-tip-notices/tipper/${encodeURIComponent(userId)}`, { cache: 'no-store' })
      if (!res.ok) return empty
      const data = await res.json()
      return Array.isArray(data?.notices) ? data : empty
    } catch {
      return empty
    }
  },

  async tipperSeen(userId: string, ids: string[]): Promise<void> {
    try {
      await fetch(`${getApiBaseUrl()}/api/failed-tip-notices/tipper/${encodeURIComponent(userId)}/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })
    } catch {
      // It will simply be offered again next visit
    }
  }
}
