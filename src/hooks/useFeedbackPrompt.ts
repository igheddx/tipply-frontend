import { useCallback, useEffect, useRef, useState } from 'react'
import { feedbackApi, type FeedbackPrompt } from '../services/feedbackApi'

export type FeedbackPhase = 'asking' | 'followup' | 'thanks' | null

/** How long the question stays in the bottom bar, counted from when it is actually on screen */
export const FEEDBACK_ASK_MS = 20000
const THANKS_MS = 2200

/**
 * Asks the tipper one short question, at most once per visit, only after a tip or song request went through.
 * The server decides whether to ask at all. Nothing here blocks the tip page: every call is fire-and-forget.
 */
export function useFeedbackPrompt(userId: string, deviceUuid: string | undefined) {
  const [prompt, setPrompt] = useState<FeedbackPrompt | null>(null)
  const [phase, setPhase] = useState<FeedbackPhase>(null)
  const askedThisVisit = useRef(false)
  // How long "Thank you" shows. The question's own timer lives in the bar, so it only runs while the question is visible.
  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (thanksTimer.current) clearTimeout(thanksTimer.current)
    thanksTimer.current = null
  }

  // Nothing is left running if the page goes away
  useEffect(() => clearTimer, [])

  const finish = useCallback(() => {
    clearTimer()
    setPhase(null)
    setPrompt(null)
  }, [])

  const dismissNow = useCallback(() => {
    if (!prompt || phase !== 'asking') return
    clearTimer()
    void feedbackApi.dismiss(prompt.promptId, userId)
    setPhase(null)
    setPrompt(null)
  }, [prompt, phase, userId])

  /** Call when a tip or song request has been accepted. Asks the server once per visit. */
  const onTipConfirmed = useCallback(
    async (usedSongPicker: boolean) => {
      if (askedThisVisit.current || !userId) return
      askedThisVisit.current = true
      // A test site can be told to ask right now with ?feedback=now (production ignores it)
      const force = new URLSearchParams(window.location.search).get('feedback') === 'now'
      const next = await feedbackApi.prompt(userId, deviceUuid, usedSongPicker, force)
      if (next) {
        setPrompt(next)
        setPhase('asking')
      }
    },
    [userId, deviceUuid]
  )

  const afterAnswer = useCallback(
    (needsFollowUp: boolean) => {
      clearTimer()
      if (needsFollowUp) {
        setPhase('followup')
      } else {
        setPhase('thanks')
        thanksTimer.current = setTimeout(finish, THANKS_MS)
      }
    },
    [finish]
  )

  const rate = useCallback(
    (rating: number) => {
      if (!prompt) return
      void feedbackApi.answer(prompt.promptId, userId, { rating })
      afterAnswer(rating <= prompt.lowScoreMax)
    },
    [prompt, userId, afterAnswer]
  )

  const choose = useCallback(
    (choice: string) => {
      if (!prompt) return
      void feedbackApi.answer(prompt.promptId, userId, { choice })
      afterAnswer(choice !== 'yes')
    },
    [prompt, userId, afterAnswer]
  )

  /** The optional "what went wrong" reason and words after a low score, or the song they wanted */
  const sendFollowUp = useCallback(
    (body: { choice?: string; comment?: string }) => {
      if (prompt && (body.choice || body.comment)) void feedbackApi.answer(prompt.promptId, userId, body)
      clearTimer()
      setPhase('thanks')
      thanksTimer.current = setTimeout(finish, THANKS_MS)
    },
    [prompt, userId, finish]
  )

  return { prompt, phase, onTipConfirmed, rate, choose, sendFollowUp, dismissNow, finish }
}
