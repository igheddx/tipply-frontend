/**
 * After a new version is published the page's old script files are gone, so opening a screen that was not loaded yet fails
 * with a "failed to load module" error and the page goes blank until it is reloaded. Reload once automatically; never loop.
 */
const KEY = 'tipwave_chunk_reload_at'
const WINDOW_MS = 15000

export const isChunkLoadError = (error: unknown): boolean => {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  return /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch dynamically|error loading dynamically/i.test(text)
}

/** Reloads the page unless it already did so in the last few seconds. Returns true when it reloaded. */
export const reloadOnceForNewVersion = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < WINDOW_MS) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* storage may be blocked; a single reload attempt is still fine */
  }
  window.location.reload()
  return true
}
