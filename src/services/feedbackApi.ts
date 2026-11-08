import { apiService } from './api'
import { getApiBaseUrl } from '../utils/config'

export interface FeedbackOption {
  key: string
  label: string
}

export interface FeedbackPrompt {
  promptId: string
  /** ease (stars) or song_found (choice) */
  question: 'ease' | 'song_found'
  kind: 'stars' | 'choice'
  text: string
  options: FeedbackOption[]
  /** A rating at or below this asks what went wrong */
  lowScoreMax: number
  reasons: FeedbackOption[]
  textPlaceholder: string
}

const json = { 'Content-Type': 'application/json' }
const base = () => `${getApiBaseUrl()}/api/feedback`

/**
 * The tipper-side calls. Feedback is a courtesy: none of these ever throws, and a failure just means nothing is shown
 * or recorded. They use the anonymous browser id, like the rest of the tip page.
 */
export const feedbackApi = {
  async prompt(userId: string, deviceUuid: string | undefined, usedSongPicker: boolean, force: boolean): Promise<FeedbackPrompt | null> {
    try {
      const res = await fetch(`${base()}/prompt`, { method: 'POST', headers: json, body: JSON.stringify({ userId, deviceUuid, usedSongPicker, force }) })
      if (!res.ok) return null
      const data = await res.json()
      return data?.prompt ?? null
    } catch {
      return null
    }
  },

  async answer(promptId: string, userId: string, body: { rating?: number; choice?: string; comment?: string }): Promise<boolean> {
    try {
      const res = await fetch(`${base()}/${promptId}/answer`, { method: 'POST', headers: json, body: JSON.stringify({ userId, ...body }) })
      return res.ok
    } catch {
      return false
    }
  },

  async dismiss(promptId: string, userId: string): Promise<void> {
    try {
      await fetch(`${base()}/${promptId}/dismiss`, { method: 'POST', headers: json, body: JSON.stringify({ userId }) })
    } catch {
      // Nothing to do; it simply will not be recorded as dismissed
    }
  },

  /** The "Give feedback" link. Returns the server's message when it is refused. */
  async submitLink(body: { userId: string; deviceUuid?: string; rating?: number; choice?: string; comment?: string }): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${base()}/link`, { method: 'POST', headers: json, body: JSON.stringify(body) })
      if (res.ok) return { ok: true }
      const data = await res.json().catch(() => null)
      return { ok: false, error: data?.error || 'Could not send your feedback. Please try again.' }
    } catch {
      return { ok: false, error: 'Could not send your feedback. Please check your connection and try again.' }
    }
  },

  // Admin
  adminSettings: () => apiService.get('/api/admin/feedback/settings'),
  adminSetSettings: (body: { mode: string; ratePercent: number; cooldownDays: number }) => apiService.put('/api/admin/feedback/settings', body),
  adminSummary: (days: number) => apiService.get(`/api/admin/feedback/summary?days=${days}`),
  adminComments: (page = 1) => apiService.get(`/api/admin/feedback/comments?page=${page}&pageSize=25`)
}
