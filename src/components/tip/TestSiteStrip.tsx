/** The amber strip that marks the test site on every tipper-facing screen, so nobody mistakes it for the live app. */
export function TestSiteStrip({ className = '' }: { className?: string }) {
  return (
    <div
      role="note"
      className={`flex-none rounded-full bg-amber-300 px-3 py-0.5 text-center text-[11px] font-extrabold uppercase tracking-wide text-amber-950 ${className}`}
    >
      Test site · not the live app
    </div>
  )
}
