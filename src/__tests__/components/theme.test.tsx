import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme, usePortalTheme } from '@/theme/ThemeContext'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

// The shared test setup replaces localStorage with no-op mocks, so use a real in-memory one here
const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear()
  }
}

const Probe = () => {
  const { preference, resolved, inPortal } = useTheme()
  return <div data-testid="probe">{`${preference}|${resolved}|${inPortal}`}</div>
}
const PortalScreen = () => {
  const { className } = usePortalTheme()
  return <div data-testid="screen" className={className} />
}

describe('theme', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.classList.remove('theme-dark')
  })

  it('starts on auto and follows the device (light here)', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('probe').textContent).toBe('system|light|false')
  })

  it('remembers a chosen theme', async () => {
    const { unmount } = render(<ThemeProvider><ThemeToggle /><Probe /></ThemeProvider>)
    await userEvent.click(screen.getByRole('radio', { name: /dark/i }))
    expect(screen.getByTestId('probe').textContent).toBe('dark|dark|false')
    unmount()
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('probe').textContent).toBe('dark|dark|false')
  })

  it('only darkens the page while a portal screen is on show', async () => {
    localStorage.setItem('tipwave_theme', 'dark')
    const { rerender } = render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false)

    await act(async () => {
      rerender(<ThemeProvider><Probe /><PortalScreen /></ThemeProvider>)
    })
    expect(screen.getByTestId('screen').className).toBe('portal-dark')
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true)

    await act(async () => {
      rerender(<ThemeProvider><Probe /></ThemeProvider>)
    })
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false)
  })
})
