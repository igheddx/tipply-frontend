import { useCallback, useEffect, useState } from 'react'
import { Banner, Button, Card, StatusChip } from '../ui'
import { apiHealthApi, type ApiHealthData, type ApiHealthWindow } from '../../services/apiHealthApi'

const count = (n?: number | null) => (n == null ? '—' : n.toLocaleString('en-US'))
const ms = (n?: number | null) => (n == null ? '—' : `${Math.round(n).toLocaleString('en-US')} ms`)
const rate = (n?: number | null) => (n == null ? '—' : `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`)
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Names the environment this page is reading, in words, so Test and Production can never be mixed up. */
function EnvironmentPill({ environment }: { environment: 'Test' | 'Production' }) {
  const test = environment === 'Test'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
        test ? 'bg-amber-100 text-amber-900' : 'bg-brand-100 text-brand-900'
      }`}
    >
      {environment}
    </span>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold text-ink-900">{value}</dd>
      {hint && <div className="text-xs text-ink-400">{hint}</div>}
    </div>
  )
}

function TargetLine({ p95, target }: { p95?: number | null; target?: number | null }) {
  if (p95 == null) return null
  if (target == null) return <p className="mt-3 text-sm text-ink-500">Internal latency target: not set yet.</p>
  const within = p95 <= target
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-700">
      <StatusChip kind={within ? 'paid' : 'processing'} label={within ? 'Within internal target' : 'Above internal target'} />
      <span className="text-ink-500">Internal target (not a customer promise): p95 under {ms(target)}</span>
    </p>
  )
}

function WindowCard({ window: w, target, stale }: { window: ApiHealthWindow; target?: number | null; stale: boolean }) {
  return (
    <Card title={w.label} subtitle={stale ? 'Last saved reading' : undefined}>
      {w.status === 'ok' && (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Requests" value={count(w.requests)} />
            <Stat label="Server errors (5xx)" value={count(w.serverErrors)} />
            <Stat label="5xx rate" value={rate(w.errorRatePercent)} />
            <Stat label="p95 gateway latency" value={ms(w.p95LatencyMs)} />
            <Stat label="p99 gateway latency" value={ms(w.p99LatencyMs)} />
          </dl>
          <TargetLine p95={w.p95LatencyMs} target={target} />
        </>
      )}
      {w.status === 'no_traffic' && (
        <div>
          <StatusChip kind="offline" label="No traffic" />
          <p className="mt-2 text-sm text-ink-500">The API received no requests in this window, so there are no rates or latency to show.</p>
        </div>
      )}
      {w.status === 'unavailable' && (
        <div>
          <StatusChip kind="failed" label="Data unavailable" />
          <p className="mt-2 text-sm text-ink-500">CloudWatch did not return numbers we can rely on for this window. Nothing is assumed.</p>
        </div>
      )}
    </Card>
  )
}

/**
 * API Health: request count, server errors, p95 and p99 gateway latency for THIS environment's own API Gateway stage.
 * Read-only. The server picks the environment; this page only shows what it is told and never assumes a healthy state.
 */
export function AdminApiHealth() {
  const [data, setData] = useState<ApiHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiHealthApi.get()
    if (res.error || !res.data) {
      setFailed(true)
    } else {
      setData(res.data as ApiHealthData)
      setFailed(false)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const environment = data?.environment ?? null
  const snapshot = data?.snapshot ?? null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
          {environment ? (
            <>
              <span>Reading the</span>
              <EnvironmentPill environment={environment} />
              <span>API</span>
            </>
          ) : (
            <span className="text-ink-500">Environment not set</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {snapshot && !data?.stale && <span className="hidden text-xs text-ink-500 sm:inline">Last refreshed {when(snapshot.fetchedAtUtc)}</span>}
          <Button variant="secondary" size="sm" icon="refresh" loading={loading} onClick={load} aria-label="Refresh API health">
            Refresh
          </Button>
        </div>
      </div>

      {failed && (
        <Banner tone="warning" title="Data unavailable">
          The page could not reach the server, so nothing is shown. This does not mean the API is healthy.
        </Banner>
      )}

      {!failed && data?.state === 'not_configured' && (
        <Banner tone="info" title="Monitoring not configured">
          The monitoring settings for this environment are missing or not valid, so no metrics are being read.
        </Banner>
      )}

      {!failed && data?.state === 'disabled' && (
        <Banner tone="info" title={`Metric reads are switched off for ${environment ?? 'this environment'}`}>
          {data.message} Turn them on in this environment's settings to see the numbers.
        </Banner>
      )}

      {!failed && data?.state === 'unavailable' && (
        <Banner tone="warning" title="Data unavailable">
          {data.message}
          {data.stale && snapshot ? ` Showing the last reading from ${when(snapshot.fetchedAtUtc)}.` : ''}
        </Banner>
      )}

      {!failed && snapshot && data && (data.state === 'ok' || data.stale) && (
        <>
          {data.stale && (
            <div>
              <StatusChip kind="processing" label="Stale" />
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {snapshot.windows.map(w => (
              <WindowCard key={w.key} window={w} target={data.latencyTargetMs} stale={data.stale} />
            ))}
          </div>
        </>
      )}

      {!failed && data && data.state !== 'not_configured' && (
        <Card title="About these numbers">
          <ul className="space-y-1.5 text-sm text-ink-500">
            <li>Counts and latency from API Gateway for this environment's stage only. This is not an uptime check.</li>
            <li>p95 and p99 are calculated by CloudWatch for each window. They are never an average of smaller windows.</li>
            <li>Read-only. The numbers refresh at most every {Math.round(data.cacheSeconds / 60)} minutes, however often this page is opened.</li>
            {data.attemptsToday != null && (
              <li>
                {data.attemptsToday} of {data.attemptsPerDay} metric reads used today for {environment} (resets at midnight UTC).
              </li>
            )}
          </ul>
        </Card>
      )}
    </div>
  )
}
