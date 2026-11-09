import { isTestVersion } from './appVersion'

/**
 * The tip page's colors. Production keeps its deep teal-navy. The test site uses deep plum (a dark shade of the brand pink),
 * so nobody taps Tip on the test site thinking it is the real one, or the other way round.
 */
export interface TipPalette {
  test: boolean
  top: string
  mid: string
  bottom: string
  /** The two soft glows inside the screen (right-top, left-bottom) */
  glowA: string
  glowB: string
}

const PRODUCTION: TipPalette = {
  test: false,
  top: '#0a2533',
  mid: '#0d4254',
  bottom: '#0f3447',
  glowA: 'rgba(6,182,200,0.26)',
  glowB: 'rgba(229,84,140,0.2)'
}

const TEST: TipPalette = {
  test: true,
  top: '#26091f',
  mid: '#4a1740',
  bottom: '#3a1233',
  glowA: 'rgba(229,84,140,0.28)',
  glowB: 'rgba(240,112,159,0.18)'
}

/** Test when this build is a test build (version starts with T) or it is opened on the test address. Everything else is production. */
export const isTestSite = (version?: string, hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''): boolean =>
  isTestVersion(version) || hostname.includes('apptest.')

export const tipPalette = (version?: string, hostname?: string): TipPalette => (isTestSite(version, hostname) ? TEST : PRODUCTION)
