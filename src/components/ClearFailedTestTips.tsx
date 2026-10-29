import { useState } from 'react'
import { apiService } from '../services/api'
import { Banner, Button, Card, useFeedback } from './ui'

interface ClearResult {
  performer: string
  failedTips: number
  withStripePayment: number
  wouldDelete: number
  deleted: number
  applied: boolean
}

/**
 * Test environment only: removes a performer's leftover failed tips. Previews first, then asks before deleting.
 * The server refuses on the production database; this card is also hidden on the production site.
 */
export default function ClearFailedTestTips() {
  const { toast, confirm } = useFeedback()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<'check' | 'delete' | null>(null)
  const [result, setResult] = useState<ClearResult | null>(null)

  if (window.location.hostname === 'app.tipwave.live') return null

  const run = async (apply: boolean) => {
    setBusy(apply ? 'delete' : 'check')
    try {
      const response = await apiService.post('/api/admin/clear-failed-tips', { email: email.trim(), apply })
      if (response.error || !response.data) {
        toast(response.error || 'Could not check the failed tips', 'error')
        return
      }
      setResult(response.data as ClearResult)
      if (apply) toast(`Deleted ${response.data.deleted} failed tips`, 'success')
    } catch {
      toast('Could not check the failed tips', 'error')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!result) return
    const ok = await confirm({
      title: `Delete ${result.wouldDelete} failed tips?`,
      body: (
        <p>
          This permanently removes {result.wouldDelete} failed tips for {result.performer} from the test database. It cannot be undone.
        </p>
      ),
      confirmLabel: 'Delete tips',
      tone: 'danger'
    })
    if (ok) await run(true)
  }

  return (
    <Card title="Clear failed tips (test only)" subtitle="Removes a performer’s leftover failed tips from the test database. Production is never touched.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[16rem] flex-1">
          <span className="mb-1 block text-sm font-medium text-ink-700">Performer email</span>
          <input
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              setResult(null)
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-ink-900"
            placeholder="performer@example.com"
          />
        </label>
        <Button variant="secondary" loading={busy === 'check'} disabled={!email.trim()} onClick={() => run(false)}>
          Check
        </Button>
      </div>

      {result && (
        <div className="mt-4">
          {result.applied ? (
            <Banner tone="success" title={`Deleted ${result.deleted} failed tips`}>
              {result.withStripePayment > 0 && result.wouldDelete < result.failedTips
                ? `${result.failedTips - result.deleted} tips with a Stripe payment were kept.`
                : 'The failed count for this performer is now clear.'}
            </Banner>
          ) : result.wouldDelete > 0 ? (
            <Banner
              tone="warning"
              title={`${result.failedTips} failed tips for ${result.performer}`}
              action={
                <Button size="sm" variant="dangerSolid" loading={busy === 'delete'} onClick={remove}>
                  Delete {result.wouldDelete} tips
                </Button>
              }
            >
              {result.withStripePayment > 0
                ? `${result.withStripePayment} of them have a Stripe payment on record and will be kept. Run Check Stripe above for those.`
                : 'None have a Stripe payment on record.'}
            </Banner>
          ) : (
            <Banner tone="info" title="Nothing to delete">
              {result.failedTips === 0 ? 'This performer has no failed tips.' : `${result.failedTips} failed tips have a Stripe payment on record and are kept.`}
            </Banner>
          )}
        </div>
      )}
    </Card>
  )
}
