import { useState } from 'react'
import { useUpdateCheck } from '../../hooks/useUpdateCheck'
import { APP_VERSION } from '../../utils/appVersion'
import { Banner } from './Banner'

/**
 * "A new version is ready." Shown only when a newer build has been published. The person taps Update when it suits them;
 * nothing reloads by itself, so a live queue is never interrupted. Dismissing hides it until the next new version.
 */
export function UpdateBanner({ running = APP_VERSION, fetcher }: { running?: string; fetcher?: typeof fetch }) {
  const { available } = useUpdateCheck(running, fetcher)
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (!available || dismissed === available) return null
  return (
    <Banner
      tone="info"
      className="mb-5"
      title="A new version of Tipwave is ready"
      onDismiss={() => setDismissed(available)}
      action={
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-9 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Update now
        </button>
      }
    >
      Tap Update when you are between songs. Nothing changes until you do.
    </Banner>
  )
}
