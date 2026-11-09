/**
 * What a tap on a tip amount does. A tipper with a saved card sends the tip at once. A first-time tipper is asked for a card instead
 * (nothing is sent, no light or sound), and the amount they chose is held and sent the moment the card is saved.
 */
export type TapDecision = 'wait' | 'ask-for-card' | 'send'

export function decideTap(o: { ready: boolean; hasCard: boolean; cardJustSaved?: boolean }): TapDecision {
  if (!o.ready) return 'wait'
  if (!o.hasCard && !o.cardJustSaved) return 'ask-for-card'
  return 'send'
}

/** "$5" or "$2.50": whole dollars have no cents. */
export const tipText = (amount: number): string => (Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`)
