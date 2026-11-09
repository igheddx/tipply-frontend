/**
 * The version of this build: R<month>.<yy>.<nnn> in production (a release), T<month>.<yy>.<nnn> on the test site.
 * The deploy sets it; a local run has none and shows "dev".
 */
export const APP_VERSION: string = (import.meta as any).env?.VITE_APP_VERSION || 'dev'

/** A version is only used if it looks like one, so a odd response can never put strange text on screen. */
const SHAPE = /^[RT][A-Za-z0-9.-]{1,24}$/

export const isVersion = (value: unknown): value is string => typeof value === 'string' && SHAPE.test(value)

export const isTestVersion = (version: string = APP_VERSION): boolean => version.startsWith('T')

/** True when the published version is a real, different version from the one this page is running. */
export const isNewerBuild = (running: string, published: unknown): boolean =>
  isVersion(published) && isVersion(running) && published !== running
