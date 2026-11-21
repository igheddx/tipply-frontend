import { Button, Modal } from './ui'

interface PaymentFailedDialogProps {
  /** The reason the payment company gave ("Your card has insufficient funds...") */
  reason: string | null
  onDismiss: () => void
  onChangeCard: () => void
}

/**
 * Shown when a tip was refused at payment. A toast vanishes in seconds, and in a loud room the tipper may not look up, so this stays
 * until it is dismissed. The device light may already have played (it does not wait for the charge), so it says so.
 */
export function PaymentFailedDialog({ reason, onDismiss, onChangeCard }: PaymentFailedDialogProps) {
  return (
    <Modal
      open={reason !== null}
      title="That tip didn't go through"
      onClose={onDismiss}
      hideClose
      footer={
        <>
          <Button variant="secondary" onClick={onDismiss}>Dismiss</Button>
          <Button onClick={onChangeCard}>Use a different card</Button>
        </>
      }
    >
      <p className="text-base text-ink-900">{reason}</p>
      <p className="mt-3 text-sm text-ink-700">You were not charged. The light may have played, but this tip was not paid.</p>
    </Modal>
  )
}

export default PaymentFailedDialog
