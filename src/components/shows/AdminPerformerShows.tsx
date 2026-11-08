import { useCallback, useEffect, useState } from 'react'
import { Table } from 'antd'
import { Banner, StatusChip } from '../ui'
import { showApi, type ShowSummary } from '../../services/showApi'
import { showTitle, showTimes } from '../../utils/showName'
import { songRequestColumns, type SongRequestRow } from '../PerformerSongRequests'

interface RequestPage {
  total: number
  performed: number
  totalAmount: number
  page: number
  pageSize: number
  items: SongRequestRow[]
}

const PAGE_SIZE = 10
const LIVE_REFRESH_MS = 15000
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`
const dayText = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * Inside an expanded row of the admin Performers table: how a performer's show is going (the same numbers they see),
 * a way to look at their earlier shows, and the song requests that came in during the show you are looking at.
 * Read-only. While a show is live it refreshes by itself.
 */
export function AdminPerformerShows({ profileId }: { profileId: string }) {
  const [shows, setShows] = useState<ShowSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [requests, setRequests] = useState<RequestPage | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const selected = shows.find(s => s.id === selectedId) ?? shows[0] ?? null

  const loadShows = useCallback(async () => {
    const res = await showApi.adminShows(profileId, 1, PAGE_SIZE)
    if (res.error || !res.data) {
      setFailed(true)
      setLoading(false)
      return
    }
    setFailed(false)
    setShows(res.data.shows)
    setLoading(false)
  }, [profileId])

  const loadRequests = useCallback(async () => {
    if (!selected) {
      setRequests(null)
      return
    }
    const res = await showApi.adminShowRequests(profileId, selected.id, page, PAGE_SIZE)
    if (res.data) setRequests(res.data)
  }, [profileId, selected?.id, page])

  useEffect(() => {
    void loadShows()
  }, [loadShows])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  // A live show keeps moving, so keep it fresh while someone is watching
  useEffect(() => {
    if (!selected?.isLive) return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadShows()
      void loadRequests()
    }, LIVE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [selected?.isLive, loadShows, loadRequests])

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
  if (failed) {
    return (
      <Banner tone="error" title="Could not load this performer's shows">
        Try again in a moment.
      </Banner>
    )
  }
  if (!selected) return <p className="text-sm text-ink-500">No shows yet. A show starts with this performer's first tip.</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-500">
          Show
          <select
            value={selected.id}
            onChange={e => {
              setSelectedId(e.target.value)
              setPage(1)
              setRequests(null)
            }}
            className="max-w-[280px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-ink-900"
          >
            {shows.map((s, i) => (
              <option key={s.id} value={s.id}>
                {showTitle(s, shows)}
                {s.isLive ? ' (live)' : ''}
                {i === 0 ? '' : ` · ${dayText(s.startedAt)}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card" aria-label="Show summary">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-ink-900">{showTitle(selected, shows)}</span>
              {selected.isLive && <StatusChip kind="active" label="Live" />}
            </div>
            <div className="mt-0.5 text-sm text-ink-500">
              {dayText(selected.startedAt)} · {showTimes(selected)}
              {selected.venueName ? ` · ${selected.venueName}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-ink-900" data-testid="admin-show-total">
              {money(selected.gross)}
            </div>
            <div className="text-xs text-ink-500">
              {plural(selected.tipCount, 'tip')}, before fees{selected.youKeep > 0 ? ` · keeps ${money(selected.youKeep)}` : ''}
            </div>
          </div>
        </div>
        {!!selected.tipperCount && (
          <p className="mt-2 text-xs text-ink-500">
            {plural(selected.tipperCount, 'tipper')}
            {selected.returningTipperCount ? ` · ${selected.returningTipperCount} had tipped them before` : ''}
          </p>
        )}
        {selected.waitingGross > 0 && <p className="mt-2 text-xs text-ink-500">{money(selected.waitingGross)} is waiting to be charged.</p>}
        {selected.refundedCount > 0 && (
          <p className="mt-1 text-xs text-ink-500">
            {plural(selected.refundedCount, 'tip')} ({money(selected.refundedGross)}) refunded to the tipper and not counted.
          </p>
        )}
      </section>

      <div>
        <div className="mb-2">
          <div className="text-sm font-semibold text-ink-900">Song requests in this show</div>
          {requests && (
            <div className="text-sm text-ink-500">
              {requests.total} requested · {requests.performed} performed · {money(requests.totalAmount)} in tips
            </div>
          )}
        </div>
        <Table<SongRequestRow>
          size="small"
          rowKey="id"
          loading={!requests}
          dataSource={requests?.items ?? []}
          locale={{ emptyText: 'No song requests in this show' }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: requests?.total ?? 0,
            showSizeChanger: false,
            hideOnSinglePage: true,
            onChange: p => setPage(p),
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
          }}
          scroll={{ x: 560 }}
          columns={songRequestColumns}
        />
      </div>
    </div>
  )
}
