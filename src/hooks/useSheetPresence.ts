import { useEffect, useState } from 'react'

/**
 * Lets a bottom sheet slide in and out with plain CSS. `mounted` says whether to render it at all, and stays true for `exitMs`
 * after the sheet is told to close, so its exit animation can play. `shown` is the state to animate towards: it turns true two
 * frames after the sheet appears (so the browser has painted the hidden position first and animates from it), and false the
 * moment the sheet is told to close.
 */
export function useSheetPresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      let second = 0
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true))
      })
      return () => {
        cancelAnimationFrame(first)
        cancelAnimationFrame(second)
      }
    }
    setShown(false)
    const timer = setTimeout(() => setMounted(false), exitMs)
    return () => clearTimeout(timer)
  }, [open, exitMs])

  return { mounted, shown }
}
