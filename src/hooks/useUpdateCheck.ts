import { useCallback, useEffect, useRef, useState } from 'react'
import { APP_VERSION, isNewerBuild, isVersion } from '../utils/appVersion'

const CHECK_EVERY_MS = 5 * 60 * 1000

/** Reads the version of the page that is published right now (version.json is written by every deploy, never cached). */
export async function fetchPublishedVersion(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return isVersion(data?.version) ? data.version : null
  } catch {
    return null
  }
}

/**
 * Tells the page when a newer version has been published. Checks every few minutes and whenever the app comes back to the
 * front. It never reloads anything: the person decides when (a performer may be mid-show with the live queue open).
 */
export function useUpdateCheck(running: string = APP_VERSION, fetcher?: typeof fetch) {
  const [available, setAvailable] = useState<string | null>(null)
  const busy = useRef(false)

  const check = useCallback(async () => {
    if (busy.current || !isVersion(running)) return
    busy.current = true
    const published = await fetchPublishedVersion(fetcher)
    busy.current = false
    if (isNewerBuild(running, published)) setAvailable(published)
  }, [running, fetcher])

  useEffect(() => {
    if (!isVersion(running)) return // a local run has no version: nothing to compare
    const id = window.setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check, running])

  return { available, check }
}
