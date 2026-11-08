import type { FeedbackPrompt } from '../../services/feedbackApi'
import type { FeedbackPhase } from '../../hooks/useFeedbackPrompt'

export function StarGlyph({ filled, size = 22 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
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
  if (phase === 'thanks') {
    return (
      <span className="w-full text-center text-sm font-bold text-white" role="status">
        Thank you!
      </span>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-between gap-2" role="group" aria-label="Quick question">
      <span className="min-w-0 flex-1 text-[12px] font-bold leading-tight text-white">{prompt.text}</span>
      {prompt.kind === 'stars' ? (
        <span className="flex flex-none items-center" role="radiogroup" aria-label="Rating, 1 to 5 stars">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={false}
              aria-label={`${n} out of 5`}
              onClick={() => onRate(n)}
              className="flex h-10 w-[30px] items-center justify-center text-amber-300 active:scale-110"
            >
              <StarGlyph filled={false} />
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
              className="h-8 rounded-full border border-white/30 bg-white/10 px-2.5 text-[12px] font-bold text-white active:bg-white/25"
            >
              {o.label}
            </button>
          ))}
        </span>
      )}
      <button type="button" onClick={onDismiss} aria-label="Not now" className="flex h-8 w-6 flex-none items-center justify-center text-white/60">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
