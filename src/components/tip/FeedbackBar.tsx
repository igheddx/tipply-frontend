import { useEffect, useState } from 'react'
import { FEEDBACK_ASK_MS } from '../../hooks/useFeedbackPrompt'
import type { FeedbackPrompt } from '../../services/feedbackApi'
import type { FeedbackPhase } from '../../hooks/useFeedbackPrompt'

export function StarGlyph({ filled, size = 22, stroke = 1.8 }: { filled: boolean; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" />
    </svg>
  )
}

interface Props {
  prompt: FeedbackPrompt
  phase: FeedbackPhase
  onRate: (rating: number) => void
  onChoose: (key: string) => void
  onDismiss: () => void
}

/**
 * The question, shown inside the bottom bar in place of the card and total. It has exactly the bar's height, so nothing
 * above it moves, and it never covers the amount buttons.
 */
export function FeedbackBar({ prompt, phase, onRate, onChoose, onDismiss }: Props) {
  // The star under the finger, so the stars up to it fill while pressing and the choice is clear
  const [pressed, setPressed] = useState(0)
  // Counts from the moment the question is on screen, and starts over whenever it is touched, so it never vanishes under a finger
  const [touches, setTouches] = useState(0)
  useEffect(() => {
    if (phase !== 'asking') return
    const timer = setTimeout(onDismiss, FEEDBACK_ASK_MS)
    return () => clearTimeout(timer)
  }, [phase, touches, onDismiss])

  if (phase === 'thanks') {
    return (
      <span className="w-full text-center text-sm font-bold text-white" role="status">
        Thank you!
      </span>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-between gap-2" role="group" aria-label="Quick question" onPointerDown={() => setTouches(t => t + 1)}>
      <span className="min-w-0 flex-1 text-[12px] font-bold leading-tight text-white">{prompt.text}</span>
      {prompt.kind === 'stars' ? (
        <span className="flex flex-none items-center" role="radiogroup" aria-label="Rating, 1 to 5 stars" onPointerLeave={() => setPressed(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={false}
              aria-label={`${n} out of 5`}
              onPointerDown={() => setPressed(n)}
              onPointerUp={() => setPressed(0)}
              onPointerCancel={() => setPressed(0)}
              onClick={() => onRate(n)}
              className="flex h-10 w-[29px] items-center justify-center text-white/85"
              style={n <= pressed ? { color: '#FFFFFF', filter: 'drop-shadow(0 0 5px rgba(34,184,214,0.85))' } : undefined}
            >
              {/* Thin white line stars, like the rest of our icons; they fill white with a soft teal glow under the finger */}
              <StarGlyph filled={n <= pressed} size={24} stroke={1.4} />
            </button>
          ))}
        </span>
      ) : (
        <span className="flex flex-none items-center gap-1.5">
          {prompt.options.map(o => (
            <button
              key={o.key}
              type="button"
              onClick={() => onChoose(o.key)}
              className="h-8 rounded-full bg-white px-3 text-[12px] font-bold text-ink-900 shadow-sm active:bg-brand-100"
            >
              {o.label}
            </button>
          ))}
        </span>
      )}
      {/* A gap and a divider keep the close button well away from the fifth star */}
      <span className="ml-1 h-5 w-px flex-none bg-white/20" aria-hidden="true" />
      <button type="button" onClick={onDismiss} aria-label="Not now" className="flex h-10 w-7 flex-none items-center justify-center text-white/70">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
