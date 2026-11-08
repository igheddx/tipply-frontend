import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui'
import { Modal } from '../ui/Modal'
import { StatusChip } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { showApi, type ShowSummary, type ShowTip } from '../../services/showApi'
import { showTitle } from '../../utils/showName'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`
const timeText = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const dayText = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

/** What a group of tips adds up to. Refunded tips are shown but never counted, the same as everywhere else. */
const totals = (tips: ShowTip[]) => {
  const counted = tips.filter(t => t.status !== 'refunded')
  return { count: counted.length, gross: counted.reduce((sum, t) => sum + t.amount, 0) }
}

interface Props {
  show: ShowSummary | null
  allShows: ShowSummary[]
  onClose: () => void
  onSplit: () => void
}

/**
 * Cut one show into two. The performer taps the first tip of the later show; a preview shows what each show would
 * hold before anything changes. "Join to the show before" puts them back together.
 */
export function SplitShowModal({ show, allShows, onClose, onSplit }: Props) {
  const { toast } = useFeedback()
  const [tips, setTips] = useState<ShowTip[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTips(null)
    setFailed(false)
    setChosen(null)
    if (!show) return
    let cancelled = false
    void showApi.tips(show.id).then(res => {
      if (cancelled) return
      if (res.error || !Array.isArray(res.data?.tips)) setFailed(true)
      else setTips(res.data.tips)
    })
    return () => {
      cancelled = true
    }
  }, [show])

  const index = useMemo(() => (tips && chosen ? tips.findIndex(t => t.id === chosen) : -1), [tips, chosen])
  const before = useMemo(() => (tips && index > 0 ? totals(tips.slice(0, index)) : null), [tips, index])
  const after = useMemo(() => (tips && index > 0 ? totals(tips.slice(index)) : null), [tips, index])

  const split = async () => {
    if (!show || !chosen) return
    setSaving(true)
    const res = await showApi.split(show.id, chosen)
    setSaving(false)
    if (res.error) {
      toast(res.error, 'error')
      return
    }
    toast('Split into two shows', 'success')
    onSplit()
  }

  return (
    <Modal
      open={!!show}
      title="Split this show"
      onClose={onClose}
      footer={
        <Button size="lg" block disabled={index < 1} loading={saving} onClick={split}>
          Split here
        </Button>
      }
    >
      {show && (
        <>
          <p className="text-sm text-ink-700">
            {showTitle(show, allShows)}: tap the <strong>first tip of the new show</strong>. Everything before it stays in this show.
          </p>

          {failed ? (
            <p className="mt-4 text-sm text-ink-700">Could not load the tips. Close this and try again.</p>
          ) : tips === null ? (
            <div className="mt-4 space-y-2" aria-busy="true">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100" aria-label="Tips in this show">
              {tips.map((tip, i) => {
                const first = i === 0
                const isChosen = tip.id === chosen
                const newDay = i > 0 && dayText(tips[i - 1].createdAt) !== dayText(tip.createdAt)
                return (
                  <li key={tip.id}>
                    {(i === 0 || newDay) && <div className="bg-slate-50 px-4 py-1.5 text-xs font-semibold text-ink-500">{dayText(tip.createdAt)}</div>}
                    {isChosen && <div className="bg-brand-50 px-4 py-1.5 text-xs font-bold text-brand-800">New show starts here</div>}
                    <button
                      type="button"
                      disabled={first}
                      aria-pressed={isChosen}
                      onClick={() => setChosen(tip.id)}
                      className={`flex min-h-[48px] w-full items-center justify-between gap-3 px-4 text-left text-sm disabled:cursor-not-allowed ${
                        isChosen ? 'bg-brand-50' : 'hover:bg-slate-50'
                      } ${first ? 'text-ink-400' : 'text-ink-900'}`}
                    >
                      <span>{timeText(tip.createdAt)}</span>
                      <span className="flex items-center gap-2">
                        {tip.status === 'refunded' && <StatusChip kind="info" label="Refunded" />}
                        {tip.status === 'pending' && <StatusChip kind="processing" label="Waiting" />}
                        <span className={`font-semibold ${tip.status === 'refunded' ? 'line-through' : ''}`}>{money(tip.amount)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {before && after && (
            <div className="mt-4 grid grid-cols-2 gap-3" data-testid="split-preview">
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs font-semibold text-ink-500">First show</div>
                <div className="text-lg font-bold text-ink-900">{money(before.gross)}</div>
                <div className="text-xs text-ink-500">{plural(before.count, 'tip')}</div>
              </div>
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                <div className="text-xs font-semibold text-brand-800">New show</div>
                <div className="text-lg font-bold text-ink-900">{money(after.gross)}</div>
                <div className="text-xs text-ink-500">{plural(after.count, 'tip')}</div>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-ink-500">Changed your mind later? Use “Join to the show before” to put them back together.</p>
        </>
      )}
    </Modal>
  )
}
