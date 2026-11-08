import { useCallback, useEffect, useState } from 'react'
import { Button, Card, EmptyState } from '../ui'
import { useFeedback } from '../ui/Feedback'
import { feedbackApi } from '../../services/feedbackApi'

interface Settings {
  mode: 'off' | 'normal' | 'frequent'
  ratePercent: number
  cooldownDays: number
}
interface QuestionStats {
  question: string
  shown: number
  answered: number
  dismissed: number
}
interface Summary {
  days: number
  questions: QuestionStats[]
  ratingCounts: number[]
  averageRating: number | null
  songChoices: Record<string, number>
  reasons: Record<string, number>
  linkEntries: number
}
interface Comment {
  id: string
  createdAt: string
  question: string
  source: string
  rating: number | null
  choice: string | null
  comment: string
  deviceName: string | null
  performerName: string | null
}

const QUESTION_LABELS: Record<string, string> = { ease: 'How easy was that?', song_found: 'Did you find the song?', general: 'Give feedback link' }
const REASON_LABELS: Record<string, string> = { payment_setup: 'Setting up a card', finding_song: 'Finding a song', didnt_work: "Something didn't work", other: 'Something else' }
const SONG_LABELS: Record<string, string> = { yes: 'Yes', kind_of: 'Sort of', no: 'No' }
const MODE_HELP: Record<Settings['mode'], string> = {
  off: 'Nobody is asked. The "Give feedback" link still works.',
  normal: 'A share of tippers is asked, at most once per wait period.',
  frequent: 'Every eligible tip asks. For testing on a test site only.'
}
const pct = (n: number, d: number) => (d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`)
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** What the platform owner sees: how people feel, what they struggled with, and the controls for how often we ask. */
export function AdminFeedback() {
  const { toast } = useFeedback()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [days, setDays] = useState(30)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [s, sum, c] = await Promise.all([feedbackApi.adminSettings(), feedbackApi.adminSummary(days), feedbackApi.adminComments(1)])
    if (s.data) setSettings(s.data)
    if (sum.data) setSummary(sum.data)
    if (Array.isArray(c.data?.comments)) setComments(c.data.comments)
    setLoading(false)
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    const res = await feedbackApi.adminSetSettings(settings)
    setSaving(false)
    if (res.error) toast(res.error, 'error')
    else {
      setSettings(res.data)
      toast('Feedback settings saved', 'success')
    }
  }

  const ratings = summary?.ratingCounts ?? [0, 0, 0, 0, 0]
  const ratingTotal = ratings.reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      <Card title="How often we ask" subtitle="Takes effect right away. No release needed.">
        {settings ? (
          <div className="space-y-4">
            <div role="radiogroup" aria-label="Feedback mode" className="grid gap-2 sm:grid-cols-3">
              {(['off', 'normal', 'frequent'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={settings.mode === m}
                  onClick={() => setSettings({ ...settings, mode: m })}
                  className={`rounded-xl border p-3 text-left ${settings.mode === m ? 'border-brand-700 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="text-sm font-bold capitalize text-ink-900">{m === 'frequent' ? 'Frequent (testing)' : m}</div>
                  <div className="mt-0.5 text-xs text-ink-500">{MODE_HELP[m]}</div>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-ink-700">
                Share of tippers asked (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.ratePercent}
                  onChange={e => setSettings({ ...settings, ratePercent: Number(e.target.value) })}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-ink-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="block text-sm font-semibold text-ink-700">
                Days to wait before asking the same person again
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={settings.cooldownDays}
                  onChange={e => setSettings({ ...settings, cooldownDays: Number(e.target.value) })}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-ink-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
            </div>
            <Button loading={saving} onClick={save}>
              Save
            </Button>
          </div>
        ) : (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink-900">What people said</h2>
        <select
          aria-label="Time range"
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-ink-900"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Star ratings" subtitle={summary?.averageRating != null ? `Average ${summary.averageRating.toFixed(1)} of 5 from ${ratingTotal} ${ratingTotal === 1 ? 'person' : 'people'}` : 'No ratings yet'}>
              <ul className="space-y-1.5" aria-label="Star ratings">
                {[5, 4, 3, 2, 1].map(n => (
                  <li key={n} className="flex items-center gap-2 text-sm">
                    <span className="w-12 text-ink-700">{n} star{n === 1 ? '' : 's'}</span>
                    <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-brand-600" style={{ width: pct(ratings[n - 1], ratingTotal) }} />
                    </span>
                    <span className="w-8 text-right tabular-nums text-ink-500">{ratings[n - 1]}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Are we asking too much?" subtitle="Shown, answered and closed without answering">
              {summary && summary.questions.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {summary.questions.map(q => (
                    <li key={q.question} className="py-2 text-sm">
                      <div className="font-semibold text-ink-900">{QUESTION_LABELS[q.question] ?? q.question}</div>
                      <div className="text-ink-500">
                        Shown {q.shown} · Answered {q.answered} ({pct(q.answered, q.shown)}) · Closed {q.dismissed} ({pct(q.dismissed, q.shown)})
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">Nothing has been asked in this period.</p>
              )}
              {!!summary?.linkEntries && <p className="mt-2 text-xs text-ink-500">{summary.linkEntries} sent from the “Give feedback” link.</p>}
            </Card>

            <Card title="What went wrong" subtitle="From low star ratings and the feedback link">
              {summary && Object.keys(summary.reasons).length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {Object.entries(summary.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span className="text-ink-700">{REASON_LABELS[k] ?? k}</span>
                      <span className="font-semibold text-ink-900">{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">No reasons yet.</p>
              )}
            </Card>

            <Card title="Did they find their song?">
              {summary && Object.keys(summary.songChoices).length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {['yes', 'kind_of', 'no'].filter(k => summary.songChoices[k] !== undefined).map(k => (
                    <li key={k} className="flex justify-between">
                      <span className="text-ink-700">{SONG_LABELS[k]}</span>
                      <span className="font-semibold text-ink-900">{summary.songChoices[k]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">No answers yet.</p>
              )}
            </Card>
          </div>

          <Card title="Comments" subtitle="In their own words, newest first" flush>
            {comments.length === 0 ? (
              <EmptyState icon="music" title="No comments yet">
                Comments from the follow-up and the Give feedback link appear here.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100 px-5 pb-2">
                {comments.map(c => (
                  <li key={c.id} className="py-3">
                    <p className="whitespace-pre-wrap text-sm text-ink-900">{c.comment}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {when(c.createdAt)} · {c.source === 'link' ? 'Give feedback link' : QUESTION_LABELS[c.question] ?? c.question}
                      {c.rating ? ` · ${c.rating} of 5` : ''}
                      {c.choice ? ` · ${REASON_LABELS[c.choice] ?? SONG_LABELS[c.choice] ?? c.choice}` : ''}
                      {c.performerName ? ` · ${c.performerName}` : ''}
                      {c.deviceName ? ` (${c.deviceName})` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
