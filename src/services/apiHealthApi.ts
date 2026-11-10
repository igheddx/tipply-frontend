import { apiService } from './api'

export type ApiHealthWindowStatus = 'ok' | 'no_traffic' | 'unavailable'

export interface ApiHealthWindow {
  key: string
  label: string
  status: ApiHealthWindowStatus
  requests?: number | null
  serverErrors?: number | null
  errorRatePercent?: number | null
  p95LatencyMs?: number | null
}

export interface ApiHealthData {
  state: 'ok' | 'not_configured' | 'disabled' | 'unavailable'
  /** From this deployment's own settings: never chosen by the browser */
  environment?: 'Test' | 'Production' | null
  message: string
  snapshot?: { fetchedAtUtc: string; windows: ApiHealthWindow[] } | null
  stale: boolean
  readsEnabled: boolean
  latencyTargetMs?: number | null
  cacheSeconds: number
  attemptsToday?: number | null
  attemptsPerDay: number
}

export const apiHealthApi = {
  /** Read-only. The server decides which environment and stage; nothing is sent. */
  get: () => apiService.get('/api/admin/api-health')
}
