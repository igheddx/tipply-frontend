import { useState } from 'react'
import { apiService } from '../services/api'
import { Banner, Button, Card, StatusChip, useFeedback } from './ui'

interface Window {
  mode: string
  from?: string
  to?: string
  tips: number
  amount: number
}

interface BackfillResult {
  applied: boolean
  hasSwitchHistory: boolean
  tipsToMark: number
  amountToMark: number
  alreadyDemo: number
  keptRealStampedTest: number
  conflictsLeftReal: number
  tipsMarked: number
  windows: Window[]
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'the beginning')

/**
 * Production only. Tips taken while Stripe was in test mode (fake money) become demo tips, like new ones. Which tips were
 * test mode comes from the recorded mode switches. Checking changes nothing; marking asks first.
 */
export default function MarkDemoTips() {
  const { toast, confirm } = useFeedback()
  const [busy, setBusy] = useState<'check' | 'mark' | null>(null)
  const [result, setResult] = useState<BackfillResult | null>(null)

  const run = async (apply: boolean) => {
    setBusy(apply ? 'mark' : 'check')
    try {
      const response = await apiService.post('/api/admin/mark-demo-tips', { apply })
      if (response.error || !response.data) {
        toast(response.error || 'Could not check past tips', 'error')
        return
      }
      setResult(response.data as BackfillResult)
      if (apply) toast(`Marked ${response.data.tipsMarked} tips as demo`, 'success')
    } catch {
      toast('Could not check past tips', 'error')
    } finally {
      setBusy(null)
    }
  }

  const mark = async () => {
    if (!result) return
    const ok = await confirm({
      title: `Mark ${result.tipsToMark} past tips as demo?`,
      body: (
        <p>
          These {result.tipsToMark} tips ({money(result.amountToMark)}) were taken while Stripe was in test mode. They will move out of the performers’ real
          totals and only show under “Show demo data”. Tips taken while payments were live are not touched.
        </p>
      ),
      confirmLabel: 'Mark as demo'
    })
    if (ok) await run(true)
  }

  return (
    <Card
      title="Past test-mode tips → demo"
      subtitle="Mark tips taken while Stripe was in test mode as demo, so they match new demo tips. Production only."
      actions={
        <Button variant="secondary" size="sm" loading={busy === 'check'} onClick={() => run(false)}>
          {result ? 'Check again' : 'Check past tips'}
        </Button>
      }
    >
      {!result && <p className="text-sm text-ink-500">Checking changes nothing. It reads the recorded test/live switches and the tips.</p>}

      {result && (
        <div className="space-y-4">
          {!result.hasSwitchHistory ? (
            <Banner tone="warning" title="No test/live switch history found">
              Without it there is no safe way to tell which past tips were test mode, so nothing can be marked.
            </Banner>
          ) : result.applied ? (
            <Banner tone="success" title={`Marked ${result.tipsMarked} tips as demo`}>
              They now show only under “Show demo data”.
            </Banner>
          ) : result.tipsToMark > 0 ? (
            <Banner
              tone="warning"
              title={`${result.tipsToMark} past tips (${money(result.amountToMark)}) were taken in test mode`}
              action={
                <Button size="sm" loading={busy === 'mark'} onClick={mark}>
                  Mark {result.tipsToMark} as demo
                </Button>
              }
            >
              {result.alreadyDemo > 0 ? `${result.alreadyDemo} more are already marked demo.` : 'None are marked demo yet.'}
            </Banner>
          ) : (
            <Banner tone="success" title="Nothing left to mark">
              {result.alreadyDemo} test-mode tips are already marked demo.
            </Banner>
          )}

          {result.hasSwitchHistory && result.keptRealStampedTest > 0 && (
            <p className="text-sm text-ink-500">
              {result.keptRealStampedTest} older tips carry a “test” label but were taken while payments were live, so they stay real.
            </p>
          )}
          {result.conflictsLeftReal > 0 && (
            <Banner tone="warning" title={`${result.conflictsLeftReal} tips need a person to look`}>
              They were taken during a test period but are labelled live. They were left as real.
            </Banner>
          )}

          {result.windows.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
              {result.windows.map((w, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <StatusChip kind={w.mode === 'live' ? 'paid' : 'processing'} label={w.mode === 'live' ? 'Live' : 'Test'} />
                  <div className="min-w-0 flex-1 text-sm text-ink-900">
                    {day(w.from)} → {w.to ? day(w.to) : 'now'}
                  </div>
                  <div className="text-sm text-ink-500">
                    {w.tips} {w.tips === 1 ? 'tip' : 'tips'} · {money(w.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
