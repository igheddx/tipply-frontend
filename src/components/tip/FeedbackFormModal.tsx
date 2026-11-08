import { useEffect, useState } from 'react'
import { Button } from '../ui'
import { Modal } from '../ui/Modal'
import { StarGlyph } from './FeedbackBar'
import type { FeedbackOption } from '../../services/feedbackApi'

export interface FeedbackBody {
  rating?: number
  choice?: string
  comment?: string
}

interface Props {
  open: boolean
  title: string
  /** Show the 1 to 5 star row (the "Give feedback" link); after a prompt the rating is already given */
  askStars?: boolean
  /** One-tap reasons, shown after a low rating (or always when there is no star row) */
  reasons?: FeedbackOption[]
  lowScoreMax?: number
  /** Whether a low rating is already known (follow-up after a prompt) */
  alreadyLow?: boolean
  placeholder: string
  sendLabel?: string
  skipLabel?: string
  onSend: (body: FeedbackBody) => Promise<{ ok: boolean; error?: string } | void>
  onClose: () => void
}

/** A short, optional form: stars (when asked), what went wrong (low scores only), and a few words. Never required. */
export function FeedbackFormModal({ open, title, askStars = false, reasons = [], lowScoreMax = 3, alreadyLow = false, placeholder, sendLabel = 'Send', skipLabel, onSend, onClose }: Props) {
  const [rating, setRating] = useState<number | null>(null)
  const [choice, setChoice] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanks, setThanks] = useState(false)

  useEffect(() => {
    if (!open) return
    setRating(null)
    setChoice(null)
    setComment('')
    setError(null)
    setThanks(false)
  }, [open])

  const low = alreadyLow || (rating !== null && rating <= lowScoreMax)
  const showReasons = reasons.length > 0 && (askStars ? low : true)
  const text = comment.trim()
  const canSend = askStars ? rating !== null || text.length > 0 : choice !== null || text.length > 0

  const send = async () => {
    setSending(true)
    setError(null)
    const body: FeedbackBody = {
      ...(rating !== null ? { rating } : {}),
      ...(showReasons && choice ? { choice } : {}),
      ...(text ? { comment: text } : {})
    }
    const result = await onSend(body)
    setSending(false)
    if (result && !result.ok) {
      setError(result.error || 'Could not send. Please try again.')
      return
    }
    if (askStars) {
      setThanks(true)
      setTimeout(onClose, 1600)
    }
  }

  return (
    <Modal
      open={open}
      title={thanks ? 'Thank you!' : title}
      onClose={onClose}
      footer={
        thanks ? undefined : (
          <>
            <Button size="lg" block disabled={!canSend} loading={sending} onClick={send}>
              {sendLabel}
            </Button>
            {skipLabel && (
              <Button size="lg" block variant="ghost" onClick={onClose}>
                {skipLabel}
              </Button>
            )}
          </>
        )
      }
    >
      {thanks ? (
        <p className="text-base text-ink-700">Your feedback helps us make Tipwave better for everyone.</p>
      ) : (
        <>
          {askStars && (
            <div role="radiogroup" aria-label="Rating, 1 to 5 stars" className="mb-4 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} out of 5`}
                  onClick={() => setRating(n)}
                  className={`flex h-12 w-12 items-center justify-center ${rating !== null && n <= rating ? 'text-brand-600' : 'text-slate-300'}`}
                >
                  <StarGlyph filled={rating !== null && n <= rating} size={34} stroke={1.5} />
                </button>
              ))}
            </div>
          )}
          {showReasons && (
            <div className="mb-4">
              <div className="mb-2 text-sm font-semibold text-ink-700">What was it about?</div>
              <div className="flex flex-wrap gap-2">
                {reasons.map(r => (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={choice === r.key}
                    onClick={() => setChoice(choice === r.key ? null : r.key)}
                    className={`min-h-[40px] rounded-full border px-3.5 text-sm font-semibold ${choice === r.key ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-ink-700'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="sr-only" htmlFor="feedback-comment">
            Your feedback
          </label>
          <textarea
            id="feedback-comment"
            value={comment}
            maxLength={500}
            rows={3}
            onChange={e => setComment(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-ink-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}
