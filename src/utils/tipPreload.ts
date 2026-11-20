/**
 * The first request the tip page makes (who is being tipped) is started by /tip-preload.js while the page code is still loading.
 * This hands that response to the page once, if it is for the same device and still fresh; otherwise the page asks for itself.
 */
interface Preload {
  url: string
  at: number
  promise: Promise<Response>
}

const MAX_AGE_MS = 60_000

export function takeTipPreload(url: string): Promise<Response> | null {
  const w = window as unknown as { __tipPreload?: Preload }
  const pre = w.__tipPreload
  w.__tipPreload = undefined // used at most once, so a later visit or a refresh never reuses an old answer
  if (!pre || pre.url !== url || Date.now() - pre.at > MAX_AGE_MS) return null
  return pre.promise
}
