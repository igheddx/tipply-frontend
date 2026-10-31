import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BrandIcon, IconTile, type BrandIconName } from '../icons/BrandIcons'
import { Banner, Button, Card, StatCard, StatusChip } from '../ui'
import { ChartTooltip } from '../charts/ChartTooltip'

export interface HomeNextStep {
  id: string
  icon: BrandIconName
  title: string
  detail: string
  done: boolean
  actionLabel: string
  onAction: () => void
}

export interface HomeData {
  firstName: string
  today: { amount: number; count: number }
  month: { amount: number; count: number; trendPercent: number; trendDirection: string }
  pendingTips: number
  failedTips: number
  failedTipsCount: number
  scheduledPayouts: number
  inTransit: number
  available: number
  lifetime: number
  /** True while Stripe balances are still loading */
  balancesLoading: boolean
  devices: { active: number; paused: number; offline: number; total: number }
  weeks: { week: string; total: number }[]
  /** True until the weekly totals have arrived */
  weeksLoading?: boolean
  nextSteps: HomeNextStep[]
}

interface HomeTabProps {
  data: HomeData
  onGoToDevices: () => void
  onGoToTips: () => void
  /** Shown when a device takes song requests: a one-tap way into the live requests screen */
  onGoToLive?: () => void
  formatCurrency: (n: number) => string
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function HomeTab({ data, onGoToDevices, onGoToTips, onGoToLive, formatCurrency }: HomeTabProps) {
  const openSteps = data.nextSteps.filter(s => !s.done)
  const money = (n: number) => (data.balancesLoading ? '…' : formatCurrency(n))
  const trend =
    data.month.trendPercent > 0
      ? `${data.month.trendDirection === 'up' ? '▲' : '▼'} ${data.month.trendPercent.toFixed(0)}% vs last month`
      : undefined

  const stats = [
    { label: 'Today', value: formatCurrency(data.today.amount), caption: plural(data.today.count, 'tip'), icon: 'sun' as BrandIconName },
    {
      label: 'This month',
      value: formatCurrency(data.month.amount),
      caption: [plural(data.month.count, 'tip'), trend].filter(Boolean).join(' · '),
      icon: 'calendar' as BrandIconName
    },
    { label: 'Ready to pay out', value: money(data.available), caption: 'Available in Stripe now', icon: 'wallet' as BrandIconName }
  ]

  const breakdown: { label: string; hint: string; value: string; icon: BrandIconName }[] = [
    { label: 'Tips waiting to be charged', hint: 'Charged in the next batch', value: formatCurrency(data.pendingTips), icon: 'clock' },
    { label: 'Scheduled payouts', hint: 'Coming from Stripe', value: money(data.scheduledPayouts), icon: 'calendar-check' },
    { label: 'On its way to your bank', hint: 'Usually 1 to 2 business days', value: money(data.inTransit), icon: 'transit' },
    { label: 'Ready to pay out', hint: 'Available in Stripe now', value: money(data.available), icon: 'wallet' },
    { label: 'All-time tips', hint: 'Everything you have been tipped', value: money(data.lifetime), icon: 'trend-up' }
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">
          {greeting()}
          {data.firstName ? `, ${data.firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-ink-500">Here is how tips are going.</p>
      </div>

      {onGoToLive && (
        <Button icon="mic" size="lg" block onClick={onGoToLive}>
          Open live song requests
        </Button>
      )}

      {/* Device status */}
      <Card className="!shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink-900">
              {data.devices.total === 0 ? 'No devices yet' : plural(data.devices.total, 'device')}
            </span>
            {data.devices.active > 0 && <StatusChip kind="active" label={`${data.devices.active} active`} />}
            {data.devices.paused > 0 && <StatusChip kind="paused" label={`${data.devices.paused} paused`} />}
            {data.devices.offline > 0 && <StatusChip kind="offline" label={`${data.devices.offline} offline`} />}
          </div>
          <Button variant="secondary" size="sm" onClick={onGoToDevices}>
            {data.devices.total === 0 ? 'Add a device' : 'Manage devices'}
          </Button>
        </div>
      </Card>

      {data.failedTipsCount > 0 && (
        <Banner
          tone="warning"
          title={`${plural(data.failedTipsCount, 'tip')} could not be charged (${formatCurrency(data.failedTips)})`}
          action={
            <Button variant="secondary" size="sm" onClick={onGoToTips}>
              See which ones
            </Button>
          }
        >
          These are not counted in what you are owed. The card was declined or no longer valid.
        </Banner>
      )}

      {/* Big numbers: tiles on larger screens, one compact list on phones */}
      <div className="hidden grid-cols-3 gap-4 sm:grid">
        {stats.map(s => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
      <Card className="sm:hidden" flush>
        <div className="divide-y divide-slate-100 px-4">
          {stats.map(s => (
            <StatCard key={s.label} {...s} variant="row" />
          ))}
        </div>
      </Card>

      {/* Next steps (only while something is left to do) */}
      {openSteps.length > 0 && (
        <Card title="Finish setting up" subtitle={`${openSteps.length} left`}>
          <ul className="divide-y divide-slate-100">
            {data.nextSteps.map(s => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <IconTile name={s.icon} state={s.done ? 'done' : 'current'} size={40} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${s.done ? 'text-ink-500' : 'text-ink-900'}`}>{s.title}</div>
                  {!s.done && <div className="text-xs text-ink-500">{s.detail}</div>}
                </div>
                {!s.done && (
                  <Button size="sm" variant="secondary" onClick={s.onAction}>
                    {s.actionLabel}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Weekly chart, always from zero */}
      <Card title="Tips per week" subtitle="Last 8 weeks">
        {data.weeksLoading ? (
          <div className="h-[220px] animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
        ) : data.weeks.every(w => w.total === 0) ? (
          <p className="py-8 text-center text-sm text-ink-500">Tips will show up here as soon as you get your first one.</p>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data.weeks} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
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
                    const row = payload?.[0]?.payload as { week: string; total: number } | undefined
                    if (!active || !row) return null
                    return <ChartTooltip active label={`Week of ${row.week}`} rows={[{ label: 'Tips', value: formatCurrency(row.total) }]} />
                  }}
                />
                <Bar dataKey="total" fill="#0891A6" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Where the money is */}
      <Card title="Where your money is" subtitle={data.balancesLoading ? 'Updating from Stripe…' : undefined} flush>
        <ul className="divide-y divide-slate-100 px-5 pb-2">
          {breakdown.map(r => (
            <li key={r.label} className="flex items-center gap-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50">
                <BrandIcon name={r.icon} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink-900">{r.label}</div>
                <div className="text-xs text-ink-500">{r.hint}</div>
              </div>
              <div className="text-sm font-bold text-ink-900">{r.value}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
