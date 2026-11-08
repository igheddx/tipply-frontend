import { apiService } from './api'

export interface ShowSummary {
  id: string
  /** The performer's own name for it; null means "use the default name" */
  name: string | null
  venueName: string | null
  startedAt: string
  /** When it ended, or its latest tip while it is still going */
  endedAt: string
  isLive: boolean
  tipCount: number
  /** Tips received (charged plus waiting), before fees. Refunded and failed tips are not counted. */
  gross: number
  waitingGross: number
  fees: number
  youKeep: number
  refundedCount: number
  refundedGross: number
  /** Different people who tipped in this show, and how many of them had tipped this performer before */
  tipperCount?: number
  returningTipperCount?: number
}

export interface ShowList {
  shows: ShowSummary[]
  total: number
  page: number
  pageSize: number
}

export interface ShowTip {
  id: string
  createdAt: string
  amount: number
  /** processed, pending or refunded */
  status: string
}

export const showApi = {
  /** Whether the shows feature is switched on for this site */
  async enabled(): Promise<boolean> {
    const res = await apiService.get('/api/features')
    return !!res.data?.shows
  },
  current: () => apiService.get('/api/shows/current'),
  list: (page = 1, pageSize = 20) => apiService.get(`/api/shows?page=${page}&pageSize=${pageSize}`),
  startNew: () => apiService.post('/api/shows/new'),
  end: (id: string) => apiService.post(`/api/shows/${id}/end`),
  update: (id: string, body: { name: string | null; venueName: string | null }) => apiService.put(`/api/shows/${id}`, body),
  mergeIntoPrevious: (id: string) => apiService.post(`/api/shows/${id}/merge`),
  venues: () => apiService.get('/api/shows/venues'),
  tips: (id: string) => apiService.get(`/api/shows/${id}/tips`),
  split: (id: string, tipId: string) => apiService.post(`/api/shows/${id}/split`, { tipId }),
  // Admin: one performer's shows and the song requests inside each
  adminShows: (profileId: string, page = 1, pageSize = 10) => apiService.get(`/api/admin/performers/${profileId}/shows?page=${page}&pageSize=${pageSize}`),
  adminShowRequests: (profileId: string, showId: string, page = 1, pageSize = 10) =>
    apiService.get(`/api/admin/performers/${profileId}/shows/${showId}/song-requests?page=${page}&pageSize=${pageSize}`),
  adminSetShows: (enabled: boolean) => apiService.put('/api/admin/features/shows', { enabled })
}
