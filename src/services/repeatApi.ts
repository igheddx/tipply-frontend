import { apiService } from './api'

export interface RepeatCohort {
  days: number
  eligible: number
  returned: number
}

export interface RepeatWeek {
  weekStart: string
  newTippers: number
  returningTippers: number
}

/** Counts only. A "visit" is a stretch of tips with no gap over four hours; "returning" means two or more visits. */
export interface RepeatStats {
  tippers: number
  returningTippers: number
  multiTipTippers: number
  regulars: number
  activeTippers: number
  activeReturningTippers: number
  totalTipAmount: number
  returningTipAmount: number
  medianDaysToReturn: number | null
  cohorts: RepeatCohort[]
  weekly: RepeatWeek[]
}

export interface PerformerRepeatRow {
  profileId: string
  tippers: number
  returningTippers: number
  regulars: number
}

export const repeatApi = {
  mine: () => apiService.get('/api/repeat-tippers/mine'),
  admin: () => apiService.get('/api/admin/repeat-tippers'),
  adminPerformers: () => apiService.get('/api/admin/repeat-tippers/performers')
}
