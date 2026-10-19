import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, EmptyState, StatCard, Tabs } from '../ui'
import { ChartTooltip } from './ChartTooltip'

export interface TipPointInput {
  timestamp: number
  amount: number
}

type Preset = '1h' | '3h' | 'today' | '24h' | '7d' | 'custom'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const toLocalInput = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Pick a bucket size that keeps the chart readable: about 12 to 60 bars. */
const bucketFor = (span: number) => (span <= 3 * HOUR ? 5 * MIN : span <= 12 * HOUR ? 15 * MIN : span <= 2 * DAY ? HOUR : DAY)

const labelFor = (ms: number, bucket: number, long = false) => {
  const d = new Date(ms)
  if (bucket >= DAY) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: bucket < HOUR ? '2-digit' : undefined })
  return long ? `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}` : time
}

const inputClass =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-ink-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500'

/** Tips over a chosen stretch of time: totals per slice of time on a true time axis, with presets instead of raw date pickers. */
export function TipsTimeline({ points }: { points: TipPointInput[] }) {
  const [preset, setPreset] = useState<Preset>('3h')
  const [custom, setCustom] = useState(() => ({ start: toLocalInput(Date.now() - 6 * HOUR), end: toLocalInput(Date.now()) }))

  const range = useMemo(() => {
    const now = Date.now()
    if (preset === 'custom') {
      const s = new Date(custom.start).getTime()
      const e = new Date(custom.end).getTime()
      return Number.isFinite(s) && Number.isFinite(e) && e > s ? { start: s, end: e } : { start: now - 3 * HOUR, end: now }
    }
    if (preset === 'today') {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return { start: d.getTime(), end: now }
    }
    const span = { '1h': HOUR, '3h': 3 * HOUR, '24h': DAY, '7d': 7 * DAY }[preset]
    return { start: now - span, end: now }
    // The window is measured from when you pick it, so a new pick is a fresh "now"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, custom, points])

  const data = useMemo(() => {
    const bucket = bucketFor(range.end - range.start)
    const first = Math.floor(range.start / bucket) * bucket
    const rows: { t: number; label: string; total: number; count: number }[] = []
    for (let t = first; t <= range.end; t += bucket) rows.push({ t, label: labelFor(t, bucket), total: 0, count: 0 })
    let total = 0
    let count = 0
    let largest = 0
    for (const p of points) {
      if (p.timestamp < range.start || p.timestamp > range.end) continue
      const row = rows[Math.min(rows.length - 1, Math.floor((p.timestamp - first) / bucket))]
      row.total += p.amount
      row.count += 1
      total += p.amount
      count += 1
      largest = Math.max(largest, p.amount)
    }
    const peak = rows.reduce((best, r) => (r.total > best.total ? r : best), rows[0])
    return { rows, bucket, total, count, largest, peak }
  }, [points, range])

  const bucketName = data.bucket >= DAY ? 'day' : data.bucket >= HOUR ? 'hour' : `${data.bucket / MIN} minutes`

  return (
    <Card
      title="Tips over time"
      subtitle={data.count > 0 && data.peak.total > 0 ? `Busiest ${bucketName}: ${labelFor(data.peak.t, data.bucket, true)} with ${money(data.peak.total)}` : undefined}
    >
      <Tabs
        active={preset}
        onChange={id => setPreset(id as Preset)}
        items={[
          { id: '1h', label: 'Last hour' },
          { id: '3h', label: '3 hours' },
          { id: 'today', label: 'Today' },
          { id: '24h', label: '24 hours' },
          { id: '7d', label: '7 days' },
          { id: 'custom', label: 'Custom' }
        ]}
      />

      {preset === 'custom' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ink-700">
            From
            <input type="datetime-local" className={`${inputClass} mt-1.5`} value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))} />
          </label>
          <label className="text-sm font-semibold text-ink-700">
            To
            <input type="datetime-local" className={`${inputClass} mt-1.5`} value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))} />
          </label>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard variant="inline" icon="coin" label="Total" value={money(data.total)} />
        <StatCard variant="inline" icon="sparkle" label="Tips" value={data.count.toLocaleString()} />
        <StatCard variant="inline" icon="trend-up" label="Average" value={data.count ? money(data.total / data.count) : '$0.00'} />
        <StatCard variant="inline" icon="wallet" label="Largest" value={money(data.largest)} />
      </div>

      {data.count === 0 ? (
        <EmptyState icon="calendar" title="No tips in this time">
          Pick a longer window to see more.
        </EmptyState>
      ) : (
        <div className="mt-5" style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={data.rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="12%">
              <CartesianGrid vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis
                domain={[0, 'auto']}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: '#64748B' }}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(8,145,166,0.08)' }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as { t: number; total: number; count: number } | undefined
                  if (!active || !row) return null
                  return (
                    <ChartTooltip
                      active
                      label={labelFor(row.t, data.bucket, true)}
                      rows={[
                        { label: 'Total', value: money(row.total) },
                        { label: 'Tips', value: String(row.count) }
                      ]}
                    />
                  )
                }}
              />
              <Bar dataKey="total" fill="#0891A6" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
