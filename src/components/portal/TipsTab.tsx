import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiService } from '../../services/api'
import { Button, Card, EmptyState, StatusChip, useFeedback, type ChipKind } from '../ui'
import { buildTipsCsv, statusLabel } from '../../utils/tipsCsv'
import { rangeFor, toDateInput, type RangePreset } from '../../utils/tipsRange'
import { RefundRequestDialog } from '../refunds/RefundRequestDialog'
import { REFUND_WINDOW_DAYS } from '../../services/refundRequestApi'

interface DeviceOption {
  id: string
  uuid?: string
  nickname?: string
}

interface TipRow {
  id: string
  deviceId: string
  amount: number
  status: string
  createdAt: string
  fees: number
  youKeep: number
  reason?: string | null
  refundedAt?: string | null
  /** pending or declined when a refund was asked for this tip */
  refundRequest?: 'pending' | 'declined' | null
}

interface Summary {
  tipCount: number
  tipsGross: number
  waitingGross: number
  fees: number
  youKeep: number
  notChargedCount: number
  notChargedGross: number
  refundedCount?: number
  refundedGross?: number
}

interface Props {
  profileId: string
  devices: DeviceOption[]
  /** Changes when the page is refreshed, so the list reloads */
  refreshKey?: unknown
  onGoToDevices: () => void
}

const PAGE_SIZE = 25
const EXPORT_PAGE_SIZE = 500
const EXPORT_MAX_ROWS = 5000

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' }
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All tips' },
  { value: 'processed', label: 'Charged' },
  { value: 'pending', label: 'Waiting' },
  { value: 'failed', label: 'Not charged' },
  { value: 'refunded', label: 'Refunded' }
]

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const chipFor = (status: string): ChipKind =>
  status === 'processed' ? 'paid' : status === 'pending' ? 'processing' : status === 'refunded' ? 'info' : 'failed'
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const selectClass =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-ink-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500'

/** The performer's tips: pick a date range, narrow by device or status, page through them, download a CSV. */
export default function TipsTab({ profileId, devices, refreshKey, onGoToDevices }: Props) {
  const { toast } = useFeedback()
  const [preset, setPreset] = useState<RangePreset>('7d')
  const today = toDateInput(new Date())
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [deviceId, setDeviceId] = useState('')
  const [status, setStatus] = useState('all')

  const [rows, setRows] = useState<TipRow[]>([])
  const [asking, setAsking] = useState<TipRow | null>(null)
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [exporting, setExporting] = useState(false)
  const request = useRef(0)

  const range = useMemo(() => rangeFor(preset, new Date(), customFrom, customTo), [preset, customFrom, customTo, refreshKey])
  const deviceName = useCallback(
    (id: string) => devices.find(d => d.id === id || d.uuid === id)?.nickname || 'Tipwave device',
    [devices]
  )

  const load = useCallback(
    async (pageNumber: number) => {
      if (!range) return
      const mine = ++request.current
      pageNumber === 1 ? setLoading(true) : setLoadingMore(true)
      const resp = await apiService.getTipHistory(profileId, { ...range, deviceId: deviceId || undefined, status, page: pageNumber, pageSize: PAGE_SIZE })
      if (mine !== request.current) return // a newer request replaced this one
      if (resp.data) {
        const incoming: TipRow[] = resp.data.items ?? []
        setRows(prev => (pageNumber === 1 ? incoming : [...prev, ...incoming]))
        setTotal(resp.data.total ?? 0)
        setSummary(resp.data.summary ?? null)
        setPage(pageNumber)
        setFailed(false)
      } else {
        setFailed(true)
      }
      setLoading(false)
      setLoadingMore(false)
    },
    [profileId, range, deviceId, status]
  )

  useEffect(() => {
    void load(1)
  }, [load, refreshKey])

  const downloadCsv = async () => {
    if (!range) return
    setExporting(true)
    try {
      const all: TipRow[] = []
      let matching = 0
      for (let p = 1; all.length < EXPORT_MAX_ROWS; p++) {
        const resp = await apiService.getTipHistory(profileId, { ...range, deviceId: deviceId || undefined, status, page: p, pageSize: EXPORT_PAGE_SIZE })
        if (!resp.data) throw new Error('load failed')
        const items: TipRow[] = resp.data.items ?? []
        matching = resp.data.total ?? 0
        all.push(...items)
        if (items.length < EXPORT_PAGE_SIZE || all.length >= matching) break
      }
      const csv = buildTipsCsv(all.slice(0, EXPORT_MAX_ROWS).map(t => ({ ...t, deviceName: deviceName(t.deviceId) })))
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `tipwave-tips-${toDateInput(range.from)}-to-${toDateInput(new Date(range.to.getTime() - 1))}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast(matching > EXPORT_MAX_ROWS ? `Downloaded the newest ${EXPORT_MAX_ROWS.toLocaleString()} of ${matching.toLocaleString()} tips. Choose a shorter range for the rest.` : `Downloaded ${all.length} tips.`, 'success')
    } catch {
      toast('Could not download your tips. Please try again.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const filtersActive = deviceId !== '' || status !== 'all'
  const clearFilters = () => {
    setDeviceId('')
    setStatus('all')
  }

  const empty = () => {
    if (devices.length === 0) {
      return (
        <EmptyState icon="device" title="Add your first device" action={<Button onClick={onGoToDevices}>Add a device</Button>}>
          Tips from your device show up here.
        </EmptyState>
      )
    }
    if (filtersActive) {
      return (
        <EmptyState icon="coin" title="No tips match these filters" action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}>
          Try a different device or status.
        </EmptyState>
      )
    }
    if (preset !== '30d') {
      return (
        <EmptyState icon="coin" title="No tips in this range" action={<Button variant="secondary" onClick={() => setPreset('30d')}>Show last 30 days</Button>}>
          New tips show up here the moment someone sends one.
        </EmptyState>
      )
    }
    return (
      <EmptyState icon="coin" title="No tips yet" action={<Button variant="secondary" onClick={onGoToDevices}>Get your QR card</Button>}>
        Share your QR code so people can tip you.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-5">
      <Card title="Your tips">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                aria-pressed={preset === p.id}
                className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  preset === p.id ? 'bg-brand-700 text-white' : 'border border-slate-300 bg-white text-ink-700 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <label className="text-sm font-semibold text-ink-700">
                From
                <input type="date" className={`${selectClass} mt-1.5`} value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)} />
              </label>
              <label className="text-sm font-semibold text-ink-700">
                To
                <input type="date" className={`${selectClass} mt-1.5`} value={customTo} min={customFrom || undefined} max={today} onChange={e => setCustomTo(e.target.value)} />
              </label>
            </div>
          )}
          {!range && <p className="text-sm text-red-700" role="alert">Choose a start and end date, up to 400 days apart.</p>}

          <div className="grid gap-3 sm:grid-cols-3">
            {devices.length > 1 && (
              <label className="text-sm font-semibold text-ink-700">
                Device
                <select className={`${selectClass} mt-1.5`} value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                  <option value="">All devices</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.nickname || 'Tipwave device'}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm font-semibold text-ink-700">
              Status
              <select className={`${selectClass} mt-1.5`} value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button variant="secondary" icon="download" block loading={exporting} disabled={!range || total === 0} onClick={downloadCsv}>
                Download CSV
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {summary && total > 0 && (
        <div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <div className="text-sm text-ink-500">Tips</div>
              <div className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">{money(summary.tipsGross)}</div>
              <div className="text-xs text-ink-400">{summary.tipCount} {summary.tipCount === 1 ? 'tip' : 'tips'}, before fees</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <div className="text-sm text-ink-500">Fees</div>
              <div className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">{money(summary.fees)}</div>
              <div className="text-xs text-ink-400">Tipwave and card fees</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <div className="text-sm text-ink-500">You keep</div>
              <div className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">{money(summary.youKeep)}</div>
              <div className="text-xs text-ink-400">After fees</div>
            </div>
          </div>
          {summary.waitingGross > 0 && (
            <p className="mt-2 text-xs text-ink-500">
              {money(summary.waitingGross)} of these tips are waiting to be charged. Fees and You keep count charged tips only.
            </p>
          )}
          {!!summary.refundedCount && status !== 'refunded' && (
            <p className="mt-2 text-sm text-ink-700">
              {summary.refundedCount} {summary.refundedCount === 1 ? 'tip' : 'tips'} ({money(summary.refundedGross ?? 0)}) {summary.refundedCount === 1 ? 'was' : 'were'} refunded to the tipper and {summary.refundedCount === 1 ? 'is' : 'are'} not counted above.{' '}
              <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setStatus('refunded')}>Show {summary.refundedCount === 1 ? 'it' : 'them'}</button>
            </p>
          )}
          {summary.notChargedCount > 0 && status !== 'failed' && (
            <p className="mt-2 text-sm text-ink-700">
              {summary.notChargedCount} {summary.notChargedCount === 1 ? 'tip' : 'tips'} ({money(summary.notChargedGross)}) could not be charged and are not counted above.{' '}
              <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setStatus('failed')}>Show them</button>
            </p>
          )}
        </div>
      )}

      <Card title={`${total.toLocaleString()} ${total === 1 ? 'tip' : 'tips'}`} flush>
        {loading ? (
          <div className="px-5 py-6" aria-busy="true">
            {[0, 1, 2].map(i => <div key={i} className="mb-3 h-12 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : failed ? (
          <EmptyState icon="coin" title="Could not load your tips" action={<Button variant="secondary" onClick={() => load(1)}>Try again</Button>}>
            Check your connection and try again.
          </EmptyState>
        ) : rows.length === 0 ? (
          empty()
        ) : (
          <>
            <ul className="divide-y divide-slate-100 px-5 pb-2">
              {rows.map(tip => (
                <li key={tip.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className={`text-base font-bold ${tip.status === 'refunded' ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{money(tip.amount)}</div>
                    <div className="truncate text-xs text-ink-500">{deviceName(tip.deviceId)} · {when(tip.createdAt)}</div>
                    {tip.status === 'processed' && <div className="text-xs text-ink-500">You keep {money(tip.youKeep)}</div>}
                    {tip.status === 'refunded' && (
                      <div className="text-xs text-ink-500">Refunded to the tipper{tip.refundedAt ? ` on ${day(tip.refundedAt)}` : ''}. Not counted in your totals.</div>
                    )}
                    {tip.reason && <div className="mt-0.5 text-sm text-ink-700">{tip.reason}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusChip kind={chipFor(tip.status)} label={statusLabel(tip.status)} />
                    {tip.refundRequest === 'pending' && <StatusChip kind="processing" label="Refund requested" />}
                    {tip.refundRequest === 'declined' && <StatusChip kind="offline" label="Not refunded" />}
                    {tip.status === 'processed' && !tip.refundRequest && Date.now() - new Date(tip.createdAt).getTime() <= REFUND_WINDOW_DAYS * 24 * 3600 * 1000 && (
                      <button
                        type="button"
                        onClick={() => setAsking(tip)}
                        className="text-xs font-semibold text-ink-500 underline hover:text-ink-700"
                        aria-label={`Request a refund for the ${money(tip.amount)} tip from ${when(tip.createdAt)}`}
                      >
                        Request refund
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {rows.length < total && (
              <div className="border-t border-slate-100 p-4 text-center">
                <Button variant="secondary" loading={loadingMore} onClick={() => load(page + 1)}>
                  Show more ({(total - rows.length).toLocaleString()} left)
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
      <RefundRequestDialog
        open={!!asking}
        tips={asking ? [{ tipId: asking.id, amount: asking.amount, createdAt: asking.createdAt }] : []}
        onClose={() => setAsking(null)}
        onRequested={() => {
          if (asking) setRows(prev => prev.map(r => (r.id === asking.id ? { ...r, refundRequest: 'pending' } : r)))
        }}
      />
    </div>
  )
}
