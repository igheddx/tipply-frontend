import { useCallback, useEffect, useState } from 'react'
import { Table } from 'antd'
import { apiService } from '../services/api'
import { Banner, StatusChip, type ChipKind } from './ui'

interface SongRequestRow {
  id: string
  songTitle: string
  artist?: string
  amount: number
  sentAt: string
  status: string
  performed: boolean
  requestorName?: string
}

interface SongRequestPage {
  date: string
  total: number
  performed: number
  totalAmount: number
  page: number
  pageSize: number
  items: SongRequestRow[]
}

const PAGE_SIZE = 10

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STATUS: Record<string, { kind: ChipKind; label: string }> = {
  completed: { kind: 'paid', label: 'Performed' },
  performing: { kind: 'processing', label: 'Playing now' },
  pending: { kind: 'info', label: 'Not performed yet' },
  skipped: { kind: 'offline', label: 'Skipped' },
  cancelled: { kind: 'offline', label: 'Cancelled' }
}

const chipFor = (row: SongRequestRow) =>
  row.performed ? STATUS.completed : STATUS[row.status] ?? { kind: 'info' as ChipKind, label: row.status }

/** A performer's song requests for one day, ten at a time. Shown when a row of the admin Performers table is expanded. */
export default function PerformerSongRequests({ profileId }: { profileId: string }) {
  const [day, setDay] = useState(todayLocal())
  const [page, setPage] = useState(1)
  const [data, setData] = useState<SongRequestPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const query = `date=${day}&timezoneOffsetMinutes=${new Date().getTimezoneOffset()}&page=${page}&pageSize=${PAGE_SIZE}`
      const response = await apiService.get(`/api/admin/performers/${profileId}/song-requests?${query}`)
      if (response.data) setData(response.data as SongRequestPage)
      else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [profileId, day, page])

  useEffect(() => {
    load()
  }, [load])

  const isToday = day === todayLocal()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink-900">{isToday ? 'Song requests today' : `Song requests on ${day}`}</div>
          {data && (
            <div className="text-sm text-ink-500">
              {data.total} requested · {data.performed} performed · ${data.totalAmount.toFixed(2)} in tips
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-500">
          Day
          <input
            type="date"
            value={day}
            max={todayLocal()}
            onChange={(e) => {
              if (e.target.value) {
                setDay(e.target.value)
                setPage(1)
              }
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-ink-900"
          />
        </label>
      </div>

      {failed && (
        <Banner tone="error" title="Could not load song requests">
          Try again in a moment.
        </Banner>
      )}

      <Table<SongRequestRow>
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={data?.items ?? []}
        locale={{ emptyText: isToday ? 'No song requests today' : 'No song requests on this day' }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          showSizeChanger: false,
          hideOnSinglePage: true,
          onChange: (p) => setPage(p),
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
        }}
        scroll={{ x: 560 }}
        columns={[
          {
            title: 'Song',
            key: 'song',
            render: (_: unknown, r: SongRequestRow) => (
              <div>
                <div className="font-medium text-ink-900">{r.songTitle}</div>
                {(r.artist || r.requestorName) && (
                  <div className="text-sm text-ink-500">{[r.artist, r.requestorName && `from ${r.requestorName}`].filter(Boolean).join(' · ')}</div>
                )}
              </div>
            )
          },
          { title: 'Amount', key: 'amount', align: 'right' as const, render: (_: unknown, r: SongRequestRow) => `$${r.amount.toFixed(2)}` },
          {
            title: 'Sent',
            key: 'sent',
            render: (_: unknown, r: SongRequestRow) => new Date(r.sentAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          },
          {
            title: 'Performed?',
            key: 'status',
            render: (_: unknown, r: SongRequestRow) => {
              const chip = chipFor(r)
              return <StatusChip kind={chip.kind} label={chip.label} />
            }
          }
        ]}
      />
    </div>
  )
}
