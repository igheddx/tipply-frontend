import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BrandIcon, IconTile, type BrandIconName } from '../icons/BrandIcons'
import { Banner, Button, Card, DisclosureChevron, EmptyState, StatCard, StatusChip } from '../ui'
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
  /** The "This show" card. When given it sits above the numbers and replaces the "Tips today" tile. */
  showSlot?: ReactNode
  /** The "Your regulars" card, shown under the numbers */
  regularsSlot?: ReactNode
  /** Refund requests waiting for review, shown near the top */
  requestsSlot?: ReactNode
  /** The one-time offer to turn on tip alerts on this phone or tablet; it shows nothing once that is done */
  alertsSlot?: ReactNode
  /** Top right of the greeting, e.g. the Refresh button */
  headerAction?: ReactNode
  formatCurrency: (n: number) => string
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function MoneyRow({ row }: { row: { label: string; hint: string; value: string; icon: BrandIconName } }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50">
        <BrandIcon name={row.icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink-900">{row.label}</div>
        <div className="text-xs text-ink-500">{row.hint}</div>
      </div>
      <div className="text-sm font-bold text-ink-900">{row.value}</div>
    </li>
  )
}

export function HomeTab({ data, onGoToDevices, onGoToTips, onGoToLive, showSlot, regularsSlot, requestsSlot, alertsSlot, headerAction, formatCurrency }: HomeTabProps) {
  const openSteps = data.nextSteps.filter(s => !s.done)
  const [showMore, setShowMore] = useState(false)
  const money = (n: number) => (data.balancesLoading ? '…' : formatCurrency(n))
  const trend =
    data.month.trendPercent > 0
      ? `${data.month.trendDirection === 'up' ? '▲' : '▼'} ${data.month.trendPercent.toFixed(0)}% vs last month`
      : undefined

  const allStats = [
    { label: 'Tips today', value: formatCurrency(data.today.amount), caption: `${plural(data.today.count, 'tip')}, before fees`, icon: 'sun' as BrandIconName },
    {
      label: 'Tips this month',
      value: formatCurrency(data.month.amount),
      caption: [`${plural(data.month.count, 'tip')}, before fees`, trend].filter(Boolean).join(' · '),
      icon: 'calendar' as BrandIconName
    },
    { label: 'Ready to pay out', value: money(data.available), caption: 'Available in Stripe now', icon: 'wallet' as BrandIconName }
  ]
  // With shows on, "This show" takes the place of the calendar-day tile
  const stats = showSlot ? allStats.slice(1) : allStats

  type Row = { label: string; hint: string; value: string; icon: BrandIconName }
  // The money in the order it moves: coming from Stripe, ready to pay out, on its way to the bank. These three words mean the same on the
  // admin's performer page.
  const moneyPath: Row[] = [
    { label: 'Coming from Stripe', hint: 'Held for a couple of days after a tip', value: money(data.scheduledPayouts), icon: 'calendar-check' },
    { label: 'Ready to pay out', hint: 'Available in Stripe now', value: money(data.available), icon: 'wallet' },
    { label: 'On its way to your bank', hint: 'Usually 1 to 2 business days', value: money(data.inTransit), icon: 'transit' }
  ]
  // Useful now and then, not every day: kept behind "More details"
  const moreDetails: Row[] = [
    { label: 'Tips waiting to be charged', hint: 'Charged in the next batch', value: formatCurrency(data.pendingTips), icon: 'clock' },
    { label: 'All-time tips', hint: 'Before fees. Payouts are after fees.', value: money(data.lifetime), icon: 'trend-up' }
  ]

  // Missing device or payouts stops tips from working, so those lead the page. Songs and a photo wait lower down.
  const setupBlocking = openSteps.some(st => st.id === 'device' || st.id === 'payouts')
  const setupCard =
    openSteps.length > 0 ? (
      <Card title="Finish setting up" subtitle={`${openSteps.length} of ${data.nextSteps.length} left`}>
        <ul className="divide-y divide-slate-100">
          {openSteps.map(s => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <IconTile name={s.icon} state="current" size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink-900">{s.title}</div>
                <div className="text-xs text-ink-500">{s.detail}</div>
              </div>
              <Button size="sm" variant="secondary" onClick={s.onAction}>
                {s.actionLabel}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    ) : null

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink-900">
            {greeting()}
            {data.firstName ? `, ${data.firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-ink-500">Here is how tips are going.</p>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {/* Anything that needs an action comes first, so it is the first thing seen */}
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
          These are not part of your earnings. Open Tips to see what happened to each one.
        </Banner>
      )}

      {requestsSlot}

      {setupBlocking && setupCard}

      {alertsSlot}

      {onGoToLive && (
        <Button icon="mic" size="lg" block onClick={onGoToLive}>
          Open Live
        </Button>
      )}

      {showSlot}

      {/* Big numbers: tiles on larger screens, one compact list on phones */}
      <div className={`hidden gap-4 sm:grid ${showSlot ? 'grid-cols-2' : 'grid-cols-3'}`}>
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

      {!setupBlocking && setupCard}

      {regularsSlot}

      {/* Weekly chart, always from zero */}
      <Card title="Tips per week" subtitle="Last 8 weeks, before fees">
        {data.weeksLoading ? (
          <div className="h-[220px] animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
        ) : data.weeks.every(w => w.total === 0) ? (
          <EmptyState icon="coin" title="No tips yet" action={<Button variant="secondary" onClick={onGoToDevices}>Get your QR card</Button>}>
            Tips will show up here as soon as you get your first one.
          </EmptyState>
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
          {moneyPath.map(r => (
            <MoneyRow key={r.label} row={r} />
          ))}
        </ul>
        <div className="border-t border-slate-100 px-5 py-2">
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            aria-expanded={showMore}
            className="flex h-10 items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-700"
          >
            <DisclosureChevron open={showMore} />
            {showMore ? 'Fewer details' : 'More details'}
          </button>
          {showMore && (
            <ul className="divide-y divide-slate-100" aria-label="More details">
              {moreDetails.map(r => (
                <MoneyRow key={r.label} row={r} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
