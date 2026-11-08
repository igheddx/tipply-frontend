import { useState } from 'react'
import { FeedbackFormModal, type FeedbackBody } from './FeedbackFormModal'
import { feedbackApi } from '../../services/feedbackApi'

const REASONS = [
  { key: 'payment_setup', label: 'Setting up my card' },
  { key: 'finding_song', label: 'Finding a song' },
  { key: 'didnt_work', label: "Something didn't work" },
  { key: 'other', label: 'Something else' }
]

/** A quiet link anyone can use at any time, including people who never completed a tip. */
export function GiveFeedbackLink({ userId, deviceUuid, className = '' }: { userId: string; deviceUuid?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  if (!userId) return null

  const send = async (body: FeedbackBody) => feedbackApi.submitLink({ userId, deviceUuid, ...body })

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`text-[11px] text-white/60 underline underline-offset-2 ${className}`}>
        Give feedback
      </button>
      <FeedbackFormModal
        open={open}
        title="How is Tipwave working for you?"
        askStars
        reasons={REASONS}
        placeholder="Tell us anything: what worked, what didn't (optional)"
        sendLabel="Send feedback"
        onSend={send}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
