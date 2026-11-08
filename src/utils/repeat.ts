import type { RepeatCohort } from '../services/repeatApi'

/** A whole-number percentage, or "–" when there is nobody to measure yet (never "0%" for no data). */
export const percent = (part: number, whole: number): string => (whole <= 0 ? '–' : `${Math.round((part / whole) * 100)}%`)

export const cohortFor = (cohorts: RepeatCohort[], days: number): RepeatCohort | undefined => cohorts.find(c => c.days === days)

/** "came back within 30 days: 40% (4 of 10)" style text, or null when nobody has been around long enough. */
export const cohortText = (cohort: RepeatCohort | undefined): string | null => {
  if (!cohort || cohort.eligible === 0) return null
  return `${percent(cohort.returned, cohort.eligible)} (${cohort.returned} of ${cohort.eligible})`
}

/** Median days to a second visit, as plain words. */
export const daysText = (days: number | null): string | null => {
  if (days === null) return null
  if (days < 1) return 'the same week'
  const rounded = Math.round(days)
  return rounded === 1 ? '1 day' : `${rounded} days`
}
