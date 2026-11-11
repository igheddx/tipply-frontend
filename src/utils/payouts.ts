// What a performer can be paid right now. The API's "stripeAvailableBalance" is really the TOTAL balance
// (available plus pending), so it must not be shown as "ready to pay out" on its own.
export interface PayoutFigures {
  stripeAvailableBalance?: number | null
  stripeFuturePayouts?: number | null
  stripeReadyToPayOut?: number | null
}

export const readyToPayOut = (m?: PayoutFigures | null): number => {
  if (!m) return 0
  if (typeof m.stripeReadyToPayOut === 'number') return Math.max(0, m.stripeReadyToPayOut)
  // An older API did not send it: total balance less the part still pending
  return Math.max(0, (m.stripeAvailableBalance ?? 0) - (m.stripeFuturePayouts ?? 0))
}
