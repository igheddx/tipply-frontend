import { useCallback, useEffect, useState } from 'react'
import { Button, StatusChip } from '../ui'
import { Modal } from '../ui/Modal'
import { showApi, type ShowTip } from '../../services/showApi'
import { useShowList } from '../../hooks/useShowList'
import { showTitle } from '../../utils/showName'
import { RefundRequestDialog } from '../refunds/RefundRequestDialog'
import { REFUND_WINDOW_DAYS } from '../../services/refundRequestApi'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const timeText = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const dayText = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const withinWindow = (iso: string) => Date.now() - new Date(iso).getTime() <= REFUND_WINDOW_DAYS * 24 * 3600 * 1000

interface Props {
  open: boolean
  /** The show to open on; the performer can switch to an earlier one */
  initialShowId?: string | null
  onClose: () => void
  /** Called after a refund request was sent */
  onChanged?: () => void
}

/**
 * Every tip from one show, with the time it came in, and a way to ask for a refund on any of them. The performer can look at
 * earlier shows too, so a tip from last night is as easy to find as one from tonight.
 */
export function ShowTipsSheet({ open, initialShowId, onClose, onChanged }: Props) {
  const { shows, hasMore: moreShows, loadMore: loadMoreShows, loadingMore: loadingMoreShows } = useShowList(open)
  const [showId, setShowId] = useState<string | null>(null)
  const [tips, setTips] = useState<ShowTip[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [asking, setAsking] = useState<ShowTip | null>(null)

  // When the list arrives, open on the chosen show (else the newest)
  useEffect(() => {
    if (!open) return
    setTips(null)
    setFailed(false)
  }, [open, initialShowId])

  useEffect(() => {
    if (!open || shows.length === 0) return
    setShowId(prev => prev ?? (initialShowId && shows.some(s => s.id === initialShowId) ? initialShowId : shows[0]?.id ?? null))
  }, [open, shows, initialShowId])

  // A fresh opening starts again from the chosen show
  useEffect(() => {
    if (!open) setShowId(null)
  }, [open])

  const loadTips = useCallback(async () => {
    if (!showId) return
    const res = await showApi.tips(showId)
    if (res.error || !Array.isArray(res.data?.tips)) setFailed(true)
    else {
      setFailed(false)
      // Newest first, the way a queue reads
      setTips([...res.data.tips].reverse())
    }
  }, [showId])

  useEffect(() => {
    setTips(null)
    void loadTips()
  }, [loadTips])

  const selected = shows.find(s => s.id === showId) ?? null

  return (
    <>
      <Modal open={open} title="Tips in this show" onClose={onClose} wide>
        {shows.length > 1 && (
          <label className="mb-3 flex items-center gap-2 text-sm text-ink-500">
            Show
            <select
              value={showId ?? ''}
              onChange={e => setShowId(e.target.value)}
              className="max-w-[260px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-ink-900"
            >
              {shows.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {showTitle(s, shows)}
                  {s.isLive ? ' (live)' : ''}
                  {i === 0 ? '' : ` · ${dayText(s.startedAt)}`}
                </option>
              ))}
            </select>
            {moreShows && (
              <button
                type="button"
                onClick={() => void loadMoreShows()}
                disabled={loadingMoreShows}
                className="rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {loadingMoreShows ? 'Loading…' : 'Older shows'}
              </button>
            )}
          </label>
        )}
        {selected && (
          <p className="mb-3 text-sm text-ink-500">
            {showTitle(selected, shows)} · {dayText(selected.startedAt)}
          </p>
        )}

        {failed ? (
          <p className="text-sm text-ink-700">Could not load the tips. Close this and try again.</p>
        ) : tips === null ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : tips.length === 0 ? (
          <p className="text-sm text-ink-700">No tips in this show yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100" aria-label="Tips in this show">
            {tips.map(t => {
              const refunded = t.status === 'refunded'
              const canAsk = t.status === 'processed' && !t.refundRequest && withinWindow(t.createdAt)
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span className="w-[4.5rem] text-sm font-semibold text-ink-900">{timeText(t.createdAt)}</span>
                  <span className={`text-base font-bold ${refunded ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{money(t.amount)}</span>
                  <span className="text-xs text-ink-500">{t.hasSongRequest ? 'Song request' : 'Tip only'}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {refunded && <StatusChip kind="info" label="Refunded" />}
                    {t.status === 'pending' && <StatusChip kind="processing" label="Waiting" />}
                    {t.refundRequest === 'pending' && <StatusChip kind="processing" label="Refund requested" />}
                    {t.refundRequest === 'declined' && <StatusChip kind="offline" label="Not refunded" />}
                    {canAsk && (
                      <Button size="sm" variant="ghost" onClick={() => setAsking(t)}>
                        Request refund
                      </Button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Modal>

      <RefundRequestDialog
        open={!!asking}
        tips={asking ? [{ tipId: asking.id, amount: asking.amount, createdAt: asking.createdAt }] : []}
        onClose={() => setAsking(null)}
        onRequested={() => {
          void loadTips()
          onChanged?.()
        }}
      />
    </>
  )
}
