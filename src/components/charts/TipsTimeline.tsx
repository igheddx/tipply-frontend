import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, EmptyState, StatCard, Tabs } from '../ui'
import { ChartTooltip } from './ChartTooltip'

export interface TipPointInput {
  timestamp: number
  amount: number
}

type Preset = '1h' | '3h' | 'today' | '24h' | '7d' | 'custom'
type View = 'totals' | 'amounts' | 'each'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

// One color per tip amount, matching the tiles on the tipping page
const TIER_COLORS = ['#2dd4bf', '#22b8d6', '#5b9bf8', '#f472b6', '#fb7185', '#f5b027', '#a78bfa', '#94a3b8']

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const tierLabel = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

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

const axisTick = { fontSize: 12, fill: '#64748B' }

/**
 * Tips over a chosen stretch of time. Three views of the same tips:
 *  Totals     dollars per slice of time
 *  By amount  how many tips of each amount per slice of time
 *  Each tip   every tip as a dot, time across and amount up
 * and a table of when each amount came in most.
 */
export function TipsTimeline({ points, loading = false }: { points: TipPointInput[]; loading?: boolean }) {
  const [preset, setPreset] = useState<Preset>('3h')
  const [view, setView] = useState<View>('totals')
  const [hidden, setHidden] = useState<Set<number>>(new Set())
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
    const inRange = points.filter(p => p.timestamp >= range.start && p.timestamp <= range.end)
    const tiers = [...new Set(inRange.map(p => p.amount))].sort((a, b) => a - b)
    const tierIndex = new Map(tiers.map((a, i) => [a, i]))

    const rows: Record<string, number | string>[] = []
    for (let t = first; t <= range.end; t += bucket) {
      const row: Record<string, number | string> = { t, label: labelFor(t, bucket), total: 0, count: 0 }
      tiers.forEach((_, i) => (row[`n${i}`] = 0))
      rows.push(row)
    }

    let total = 0
    let largest = 0
    const perTier = tiers.map(() => ({ count: 0, total: 0, bucketCounts: new Map<number, number>() }))
    inRange.forEach((p, k) => {
      const row = rows[Math.min(rows.length - 1, Math.floor((p.timestamp - first) / bucket))]
      const i = tierIndex.get(p.amount)!
      row.total = (row.total as number) + p.amount
      row.count = (row.count as number) + 1
      row[`n${i}`] = (row[`n${i}`] as number) + 1
      total += p.amount
      largest = Math.max(largest, p.amount)
      const tt = perTier[i]
      tt.count += 1
      tt.total += p.amount
      tt.bucketCounts.set(row.t as number, (tt.bucketCounts.get(row.t as number) ?? 0) + 1)
      void k
    })

    // Dots: a tiny steady offset so tips with the same amount at nearly the same moment do not sit on top of each other
    const dots = inRange.map((p, k) => {
      const i = tierIndex.get(p.amount)!
      return { t: p.timestamp, y: i + (((k * 37) % 17) / 17 - 0.5) * 0.5, amount: p.amount, tier: i }
    })

    const peak = rows.reduce((best, r) => ((r.total as number) > (best.total as number) ? r : best), rows[0])
    const tierRows = tiers.map((amount, i) => {
      const tt = perTier[i]
      let bestT = 0
      let bestN = 0
      tt.bucketCounts.forEach((n, t) => {
        if (n > bestN) {
          bestN = n
          bestT = t
        }
      })
      return { amount, color: TIER_COLORS[i % TIER_COLORS.length], count: tt.count, total: tt.total, peakT: bestT, peakN: bestN }
    })

    // About six evenly spaced time labels for the dot chart
    const ticks = Array.from({ length: 6 }, (_, k) => Math.round(range.start + ((range.end - range.start) * k) / 5))
    return { rows, bucket, total, count: inRange.length, largest, peak, tiers, dots, tierRows, ticks }
  }, [points, range])

  const bucketName = data.bucket >= DAY ? 'day' : data.bucket >= HOUR ? 'hour' : `${data.bucket / MIN} minutes`
  const toggleTier = (i: number) =>
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  if (loading) {
    return (
      <Card title="Tips over time" subtitle="Loading your tips…">
        <div className="animate-pulse space-y-4" aria-busy="true">
          <div className="h-10 w-2/3 rounded-xl bg-slate-100" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-slate-100" />
        </div>
      </Card>
    )
  }

  const legend = (
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Tip amounts">
      {data.tierRows.map((t, i) => {
        const off = hidden.has(i)
        return (
          <button
            key={t.amount}
            onClick={() => toggleTier(i)}
            aria-pressed={!off}
            className={`flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-opacity ${off ? 'border-slate-200 text-ink-400 opacity-60' : 'border-slate-200 text-ink-700'}`}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: off ? '#CBD5E1' : t.color }} />
            {tierLabel(t.amount)}
          </button>
        )
      })}
    </div>
  )

  return (
    <Card
      title="Tips over time"
      subtitle={data.count > 0 && (data.peak.total as number) > 0 ? `Busiest ${bucketName}: ${labelFor(data.peak.t as number, data.bucket, true)} with ${money(data.peak.total as number)}` : undefined}
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
        <>
          <div className="mt-6">
            <Tabs
              active={view}
              onChange={id => setView(id as View)}
              items={[
                { id: 'totals', label: 'Totals' },
                { id: 'amounts', label: 'By amount' },
                { id: 'each', label: 'Each tip' }
              ]}
            />
            <p className="mt-2 text-sm text-ink-500">
              {view === 'totals' && 'Dollars tipped in each slice of time.'}
              {view === 'amounts' && 'How many tips of each amount came in, slice by slice. Tap an amount to hide it.'}
              {view === 'each' && 'Every tip is a dot: time across, amount up. Tap an amount to hide it.'}
            </p>
          </div>

          {view !== 'totals' && legend}

          <div className="mt-4" style={{ width: '100%', height: view === 'each' ? 300 : 260 }}>
            <ResponsiveContainer>
              {view === 'each' ? (
                <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    dataKey="t"
                    domain={[range.start, range.end]}
                    ticks={data.ticks}
                    tickFormatter={(v: number) => labelFor(v, Math.min(data.bucket, HOUR))}
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[-0.6, data.tiers.length - 0.4]}
                    ticks={data.tiers.map((_, i) => i)}
                    tickFormatter={(i: number) => tierLabel(data.tiers[i] ?? 0)}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tick={axisTick}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      const d = payload?.[0]?.payload as { t: number; amount: number } | undefined
                      if (!active || !d) return null
                      return <ChartTooltip active label={labelFor(d.t, MIN, true)} rows={[{ label: 'Tip', value: money(d.amount) }]} />
                    }}
                  />
                  {data.tierRows.map((t, i) =>
                    hidden.has(i) ? null : (
                      <Scatter key={t.amount} data={data.dots.filter(d => d.tier === i)} fill={t.color} fillOpacity={0.8} isAnimationActive={false} />
                    )
                  )}
                </ScatterChart>
              ) : (
                <BarChart data={data.rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="12%">
                  <CartesianGrid vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} tick={axisTick} />
                  <YAxis
                    domain={[0, 'auto']}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                    tickFormatter={(v: number) => (view === 'totals' ? `$${v}` : String(v))}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(8,145,166,0.08)' }}
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as Record<string, number> | undefined
                      if (!active || !row) return null
                      const lines =
                        view === 'totals'
                          ? [
                              { label: 'Total', value: money(row.total) },
                              { label: 'Tips', value: String(row.count) }
                            ]
                          : [
                              ...data.tierRows.map((t, i) => ({ label: tierLabel(t.amount), value: String(row[`n${i}`] ?? 0) })).filter(r => r.value !== '0'),
                              { label: 'Total', value: money(row.total) }
                            ]
                      return <ChartTooltip active label={labelFor(row.t, data.bucket, true)} rows={lines} />
                    }}
                  />
                  {view === 'totals' ? (
                    <Bar dataKey="total" fill="#0891A6" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false} />
                  ) : (
                    data.tierRows.map((t, i) =>
                      hidden.has(i) ? null : (
                        <Bar key={t.amount} dataKey={`n${i}`} stackId="amounts" fill={t.color} maxBarSize={34} isAnimationActive={false} />
                      )
                    )
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* The direct answer to "when did each amount come in?" */}
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-500">When each amount came in</h3>
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Amount</th>
                    <th className="px-4 py-2.5 font-bold">Tips</th>
                    <th className="hidden px-4 py-2.5 font-bold sm:table-cell">Total</th>
                    <th className="px-4 py-2.5 font-bold">Most at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...data.tierRows].reverse().map(t => (
                    <tr key={t.amount}>
                      <td className="px-4 py-3 font-bold text-ink-900">
                        <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: t.color }} />
                        {tierLabel(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{t.count}</td>
                      <td className="hidden px-4 py-3 text-ink-700 sm:table-cell">{money(t.total)}</td>
                      <td className="px-4 py-3 text-ink-700">
                        {t.peakN > 0 ? `${labelFor(t.peakT, data.bucket, data.bucket >= HOUR)} (${t.peakN} ${t.peakN === 1 ? 'tip' : 'tips'})` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
