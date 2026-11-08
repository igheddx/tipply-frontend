import { useCallback, useEffect, useState } from 'react'
import { Button, Card, EmptyState, StatusChip } from '../ui'
import { Modal } from '../ui/Modal'
import { useFeedback } from '../ui/Feedback'
import { showApi, type ShowSummary } from '../../services/showApi'
import { defaultShowName, showTitle, showTimes } from '../../utils/showName'
import { VenuePicker } from './VenuePicker'
import { SplitShowModal } from './SplitShowModal'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`
const dayText = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const PAGE_SIZE = 20

/** Every show, newest first, each with its own total. Rename, set the place, join to the show before, or end it. */
export function ShowsList({ refreshKey }: { refreshKey?: string | number }) {
  const { toast, confirm } = useFeedback()
  const [shows, setShows] = useState<ShowSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState<ShowSummary | null>(null)
  const [name, setName] = useState('')
  const [venue, setVenue] = useState<string | null>(null)
  const [pickingVenue, setPickingVenue] = useState(false)
  const [saving, setSaving] = useState(false)
  const [splitting, setSplitting] = useState<ShowSummary | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    const res = await showApi.list(1, PAGE_SIZE)
    if (res.error || !res.data) {
      setFailed(true)
    } else {
      setShows(res.data.shows)
      setTotal(res.data.total)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const more = async () => {
    setLoadingMore(true)
    const res = await showApi.list(Math.floor(shows.length / PAGE_SIZE) + 1, PAGE_SIZE)
    setLoadingMore(false)
    if (res.data) setShows(prev => [...prev, ...res.data.shows.filter((s: ShowSummary) => !prev.some(p => p.id === s.id))])
  }

  const openEdit = (show: ShowSummary) => {
    setEditing(show)
    setName(show.name ?? '')
    setVenue(show.venueName)
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    const res = await showApi.update(editing.id, { name: name.trim() || null, venueName: venue })
    setSaving(false)
    if (res.error) {
      toast(res.error, 'error')
      return
    }
    setEditing(null)
    await load()
  }

  const merge = async (show: ShowSummary) => {
    const ok = await confirm({
      title: 'Join to the show before?',
      body: 'The two shows become one, and their totals add together. You can’t split them again.',
      confirmLabel: 'Join them'
    })
    if (!ok) return
    const res = await showApi.mergeIntoPrevious(show.id)
    if (res.error) toast(res.error, 'error')
    else {
      toast('Shows joined', 'success')
      await load()
    }
  }

  const end = async (show: ShowSummary) => {
    const res = await showApi.end(show.id)
    if (res.error) toast(res.error, 'error')
    else await load()
  }

  if (loading) {
    return (
      <div aria-busy="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="mb-3 h-20 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    )
  }
  if (failed) {
    return (
      <EmptyState icon="coin" title="Could not load your shows" action={<Button variant="secondary" onClick={load}>Try again</Button>}>
        Check your connection and try again.
      </EmptyState>
    )
  }
  if (shows.length === 0) {
    return (
      <EmptyState icon="music" title="No shows yet">
        Your first tip starts your first show, and each show gets its own total.
      </EmptyState>
    )
  }

  return (
    <>
      <Card title={plural(total, 'show')} flush>
        <ul className="divide-y divide-slate-100 px-5 pb-2">
          {shows.map((show, index) => (
            <li key={show.id} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-ink-900">{showTitle(show, shows)}</span>
                    {show.isLive && <StatusChip kind="active" label="Live" />}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    {dayText(show.startedAt)} · {showTimes(show)}
                    {show.venueName ? ` · ${show.venueName}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-ink-900">{money(show.gross)}</div>
                  <div className="text-xs text-ink-500">
                    {plural(show.tipCount, 'tip')}
                    {show.youKeep > 0 ? ` · keep ${money(show.youKeep)}` : ''}
                  </div>
                </div>
              </div>
              {show.refundedCount > 0 && (
                <div className="mt-1 text-xs text-ink-500">
                  {plural(show.refundedCount, 'tip')} ({money(show.refundedGross)}) refunded to the tipper and not counted.
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(show)}>
                  Name and place
                </Button>
                {show.tipCount + show.refundedCount >= 2 && (
                  <Button size="sm" variant="ghost" onClick={() => setSplitting(show)}>
                    Split
                  </Button>
                )}
                {index < shows.length - 1 || shows.length < total ? (
                  <Button size="sm" variant="ghost" onClick={() => merge(show)}>
                    Join to the show before
                  </Button>
                ) : null}
                {show.isLive && (
                  <Button size="sm" variant="ghost" onClick={() => end(show)}>
                    End show
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {shows.length < total && (
          <div className="border-t border-slate-100 p-4 text-center">
            <Button variant="secondary" loading={loadingMore} onClick={more}>
              Show more ({total - shows.length} left)
            </Button>
          </div>
        )}
      </Card>

      <Modal
        open={!!editing}
        title="Name and place"
        onClose={() => setEditing(null)}
        footer={
          <Button size="lg" block loading={saving} onClick={save}>
            Save
          </Button>
        }
      >
        {editing && (
          <>
            <label className="block text-sm font-semibold text-ink-700" htmlFor="show-name">
              Name
            </label>
            <input
              id="show-name"
              value={name}
              maxLength={100}
              onChange={e => setName(e.target.value)}
              placeholder={defaultShowName(editing)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-ink-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="mt-4 text-sm font-semibold text-ink-700">Where</div>
            <button
              type="button"
              onClick={() => setPickingVenue(true)}
              className="mt-1.5 flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-base text-ink-900 hover:bg-slate-50"
            >
              <span className={venue ? '' : 'text-ink-400'}>{venue ?? 'Add a place (optional)'}</span>
            </button>
          </>
        )}
      </Modal>
      <SplitShowModal
        show={splitting}
        allShows={shows}
        onClose={() => setSplitting(null)}
        onSplit={async () => {
          setSplitting(null)
          await load()
        }}
      />
      <VenuePicker
        open={pickingVenue}
        current={venue}
        onPick={v => {
          setVenue(v)
          setPickingVenue(false)
        }}
        onClose={() => setPickingVenue(false)}
      />
    </>
  )
}
