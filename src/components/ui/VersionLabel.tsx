import { APP_VERSION, isTestVersion } from '../../utils/appVersion'

/** The build number, small and quiet, with a TEST pill on the test site. Handy to read out when asking for support. */
export function VersionLabel({ className = '', version = APP_VERSION }: { className?: string; version?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] text-ink-500 ${className}`} aria-label={`Version ${version}`}>
      {isTestVersion(version) && <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-amber-800">Test</span>}
      <span className="tabular-nums">{version}</span>
    </span>
  )
}
