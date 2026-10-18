interface PageLoaderProps {
  label?: string
}

/** A full-page loading state: the Tipwave monogram, gently pulsing. */
export function PageLoader({ label = 'Loading…' }: PageLoaderProps) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center bg-surface">
      <img src="/images/logo/tipwave-monogram.png" alt="" className="h-12 w-auto animate-pulse" />
      <p className="mt-4 text-sm text-ink-500">{label}</p>
    </div>
  )
}
