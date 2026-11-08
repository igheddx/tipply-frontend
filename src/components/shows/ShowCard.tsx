import { useCallback, useEffect, useState } from 'react'
import { Button, Card, StatusChip } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { showApi, type ShowSummary } from '../../services/showApi'
import { showTitle, showTimes } from '../../utils/showName'
import { VenuePicker } from './VenuePicker'

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

/**
 * The top card of the dashboard: what you have made in this show so far. It keeps counting across midnight, and
 * "New show" starts again from $0 for the times you want a clean start.
 */
export function ShowCard({ refreshKey, onSeeShows }: { refreshKey?: string | number; onSeeShows?: () => void }) {
  const { toast, confirm } = useFeedback()
  const [show, setShow] = useState<ShowSummary | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)

  const load = useCallback(async () => {
    const res = await showApi.current()
    setShow(res.data?.show ?? null)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  // Keep the number moving while a show is going
  useEffect(() => {
    if (!show?.isLive) return
    const timer = setInterval(() => void load(), 30000)
    return () => clearInterval(timer)
  }, [show?.isLive, load])

  if (!loaded) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />

  const startNew = async () => {
    if (show?.isLive) {
      const ok = await confirm({
        title: 'Start a new show?',
        body: `Your current show closes now at ${money(show.gross)}, and the new one starts from $0.`,
        confirmLabel: 'Start new show'
      })
      if (!ok) return
    }
    setBusy(true)
    const res = await showApi.startNew()
    setBusy(false)
    if (res.error) toast(res.error, 'error')
    else setShow(res.data)
  }

  const end = async () => {
    if (!show) return
    setBusy(true)
    const res = await showApi.end(show.id)
    setBusy(false)
    if (res.error) toast(res.error, 'error')
    else {
      setShow(res.data)
      toast('Show ended', 'success')
    }
  }

  const setVenue = async (venueName: string | null) => {
    setPicking(false)
    if (!show) return
    const res = await showApi.update(show.id, { name: show.name, venueName })
    if (res.error) toast(res.error, 'error')
    else setShow(res.data)
  }

  if (!show) {
    return (
      <Card title="Your shows" subtitle="Every show you play gets its own total, even when it runs past midnight.">
        <p className="text-sm text-ink-700">Your first tip starts your first show. Or start one now to begin counting from $0.</p>
        <Button className="mt-4" icon="play" loading={busy} onClick={startNew}>
          Start a show
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-ink-900">{show.isLive ? 'This show' : 'Last show'}</h2>
            {show.isLive && <StatusChip kind="active" label="Live" />}
          </div>
          <p className="mt-0.5 text-sm text-ink-500">
            {showTitle(show)} · {showTimes(show)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="min-h-[36px] rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-ink-700 hover:bg-slate-50"
        >
          {show.venueName ? show.venueName : 'Add where you’re playing'}
        </button>
      </div>

      <div className="mt-4 text-4xl font-bold text-ink-900 sm:text-5xl" data-testid="show-total">
        {money(show.gross)}
      </div>
      <p className="mt-1 text-sm text-ink-500">
        {plural(show.tipCount, 'tip')}, before fees
        {show.youKeep > 0 ? ` · You keep ${money(show.youKeep)}` : ''}
      </p>
      {show.waitingGross > 0 && <p className="mt-1 text-xs text-ink-500">{money(show.waitingGross)} is waiting to be charged. You keep counts charged tips only.</p>}
      {show.refundedCount > 0 && (
        <p className="mt-1 text-xs text-ink-500">
          {plural(show.refundedCount, 'tip')} ({money(show.refundedGross)}) refunded to the tipper and not counted.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" icon="plus" loading={busy} onClick={startNew}>
          New show
        </Button>
        {show.isLive && (
          <Button variant="ghost" loading={busy} onClick={end}>
            End show
          </Button>
        )}
        {onSeeShows && (
          <Button variant="ghost" onClick={onSeeShows}>
            All shows
          </Button>
        )}
      </div>

      <VenuePicker open={picking} current={show.venueName} onPick={setVenue} onClose={() => setPicking(false)} />
    </Card>
  )
}
