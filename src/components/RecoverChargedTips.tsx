import { useState } from 'react'
import { apiService } from '../services/api'
import { Banner, Button, Card, StatusChip, useFeedback, type ChipKind } from './ui'

interface Group {
  stripeCustomerId: string
  tipCount: number
  amount: number
  failedAt?: string
  outcome: 'match' | 'no_charge_found' | 'ambiguous' | 'refunded' | 'already_linked'
  applied: boolean
}

interface ReconcileResult {
  stripeMode: string
  applied: boolean
  groupsChecked: number
  groupsMatched: number
  tipsMatched: number
  amountMatched: number
  groups: Group[]
}

const OUTCOMES: Record<Group['outcome'], { kind: ChipKind; label: string; note: string }> = {
  match: { kind: 'paid', label: 'Charged', note: 'Stripe took this payment. It can be fixed.' },
  no_charge_found: { kind: 'failed', label: 'Really failed', note: 'Stripe has no matching charge.' },
  ambiguous: { kind: 'processing', label: 'Unclear', note: 'More than one possible charge. Skipped.' },
  refunded: { kind: 'info', label: 'Refunded', note: 'Charged, then refunded. Skipped.' },
  already_linked: { kind: 'offline', label: 'Already recorded', note: 'This charge is already on other tips.' }
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Some tips were marked failed even though Stripe charged the card. This checks Stripe (read-only), shows what it found,
 * and only changes anything after a confirmation.
 */
export default function RecoverChargedTips() {
  const { toast, confirm } = useFeedback()
  const [busy, setBusy] = useState<'check' | 'fix' | null>(null)
  const [result, setResult] = useState<ReconcileResult | null>(null)

  const run = async (apply: boolean) => {
    setBusy(apply ? 'fix' : 'check')
    try {
      const response = await apiService.post('/api/admin/reconcile-failed-tips', { apply, lookbackDays: 30 })
      if (response.error || !response.data) {
        toast(response.error || 'Could not check Stripe', 'error')
        return
      }
      setResult(response.data as ReconcileResult)
      if (apply) toast(`Fixed ${response.data.tipsMatched} tips`, 'success')
    } catch {
      toast('Could not check Stripe', 'error')
    } finally {
      setBusy(null)
    }
  }

  const fix = async () => {
    if (!result) return
    const ok = await confirm({
      title: `Mark ${result.tipsMatched} tips as charged?`,
      body: (
        <p>
          Stripe shows {money(result.amountMatched)} was taken for these tips in {result.stripeMode} mode. They will change from failed to charged and be
          counted in the performers’ earnings. This is based on the Stripe charges listed below.
        </p>
      ),
      confirmLabel: 'Fix tips'
    })
    if (ok) await run(true)
  }

  return (
    <Card
      title="Failed tips that were actually charged"
      subtitle="Until recently, a charge could succeed while its tips were marked failed. Check Stripe to find them."
      actions={
        <Button variant="secondary" size="sm" loading={busy === 'check'} onClick={() => run(false)}>
          {result ? 'Check again' : 'Check Stripe'}
        </Button>
      }
    >
      {!result && <p className="text-sm text-ink-500">Nothing is changed by checking. It only reads from Stripe, for the last 30 days.</p>}

      {result && (
        <div className="space-y-4">
          {result.groupsChecked === 0 ? (
            <Banner tone="success" title="Nothing to fix">
              There are no failed tips from the last 30 days in {result.stripeMode} mode.
            </Banner>
          ) : result.applied ? (
            <Banner tone="success" title={`Fixed ${result.tipsMatched} tips (${money(result.amountMatched)})`}>
              They now show as charged. The rest really failed.
            </Banner>
          ) : result.groupsMatched > 0 ? (
            <Banner
              tone="warning"
              title={`${result.tipsMatched} tips (${money(result.amountMatched)}) were charged but are marked failed`}
              action={
                <Button size="sm" loading={busy === 'fix'} onClick={fix}>
                  Fix {result.tipsMatched} tips
                </Button>
              }
            >
              Checked {result.groupsChecked} groups of failed tips in {result.stripeMode} mode. The others really failed.
            </Banner>
          ) : (
            <Banner tone="info" title="No charged tips found">
              Checked {result.groupsChecked} groups of failed tips in {result.stripeMode} mode. They really failed.
            </Banner>
          )}

          {result.groups.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
              {result.groups.map((g, i) => {
                const o = OUTCOMES[g.outcome]
                return (
                  <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <StatusChip kind={g.applied ? 'paid' : o.kind} label={g.applied ? 'Fixed' : o.label} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink-900">
                        {money(g.amount)} · {g.tipCount} {g.tipCount === 1 ? 'tip' : 'tips'}
                      </div>
                      <div className="text-xs text-ink-500">
                        {o.note} Customer …{g.stripeCustomerId.slice(-6)}
                        {g.failedAt ? ` · ${new Date(g.failedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
