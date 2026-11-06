import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { isChunkLoadError, reloadOnceForNewVersion } from '@/utils/chunkReload'

const Boom = ({ message }: { message: string }): React.ReactElement => {
  throw new Error(message)
}

describe('crash handling', () => {
  const reload = vi.fn()
  beforeEach(() => {
    reload.mockClear()
    sessionStorage.clear()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('recognises the errors a newly published version causes', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/VenueDashboard-abc.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  it('shows a way forward instead of a blank page when a screen crashes', () => {
    render(<AppErrorBoundary><Boom message="Cannot read properties of undefined" /></AppErrorBoundary>)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalled()
  })

  it('reloads by itself once when a screen failed to load because of a new version', () => {
    render(<AppErrorBoundary><Boom message="Failed to fetch dynamically imported module" /></AppErrorBoundary>)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never reloads in a loop', () => {
    expect(reloadOnceForNewVersion()).toBe(true)
    expect(reloadOnceForNewVersion()).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('renders its children when nothing is wrong', () => {
    render(<AppErrorBoundary><p>fine</p></AppErrorBoundary>)
    expect(screen.getByText('fine')).toBeInTheDocument()
  })
})
