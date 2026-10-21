import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'
import { Toast, type ToastTone } from './Toast'
import { useTheme } from '../../theme/ThemeContext'

export interface ConfirmOptions {
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** "danger" makes the confirm button solid red, for things that cannot be undone */
  tone?: 'default' | 'danger'
}

interface FeedbackValue {
  /** A short message at the top of the screen. Errors open a dialog the person has to dismiss; other tones stay a quiet toast. */
  toast: (message: string, tone?: ToastTone) => void
  /** Ask the user to confirm. Resolves true on confirm, false on cancel. Replaces the browser's confirm(). */
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackValue>({
  toast: () => undefined,
  confirm: () => Promise.resolve(false)
})

export const useFeedback = () => useContext(FeedbackContext)

/** One place that shows toasts and confirmation dialogs, in the Tipwave style, in light or dark. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { resolved, inPortal } = useTheme()
  const [toastState, setToastState] = useState<{ message: string; tone: ToastTone } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    if (tone === 'error') {
      setToastState(null)
      setErrorMessage(message)
      return
    }
    window.clearTimeout(timer.current)
    setToastState({ message, tone })
    timer.current = window.setTimeout(() => setToastState(null), 4500)
  }, [])

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ options, resolve })),
    []
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const settle = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])
  const o = pending?.options

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {/* No layout of its own: only fixed-position children. The class lets the dark theme reach them. */}
      <div className={inPortal && resolved === 'dark' ? 'portal-dark' : ''} style={{ background: 'none' }}>
        {toastState && <Toast tone={toastState.tone} message={toastState.message} onDismiss={() => setToastState(null)} />}
        <Modal
          open={!!pending}
          title={o?.title ?? ''}
          onClose={() => settle(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => settle(false)}>
                {o?.cancelLabel ?? 'Cancel'}
              </Button>
              <Button variant={o?.tone === 'danger' ? 'dangerSolid' : 'primary'} onClick={() => settle(true)}>
                {o?.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          {o?.body && <div className="text-ink-700">{o.body}</div>}
        </Modal>
        <Modal
          open={errorMessage !== null}
          title="Something went wrong"
          onClose={() => setErrorMessage(null)}
          footer={<Button onClick={() => setErrorMessage(null)}>OK</Button>}
        >
          <p className="text-ink-700">{errorMessage}</p>
        </Modal>
      </div>
    </FeedbackContext.Provider>
  )
}
