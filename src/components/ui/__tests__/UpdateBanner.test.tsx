import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { UpdateBanner } from '../UpdateBanner'
import { VersionLabel } from '../VersionLabel'
import { isNewerBuild, isVersion } from '../../../utils/appVersion'
import { fetchPublishedVersion } from '../../../hooks/useUpdateCheck'

const answering = (version: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => ({ version }) })) as unknown as typeof fetch

afterEach(() => vi.useRealTimers())

describe('version helpers', () => {
  it('accepts real versions and rejects everything else', () => {
    expect(isVersion('R11.26.004')).toBe(true)
    expect(isVersion('T1.27.001')).toBe(true)
    expect(isVersion('dev')).toBe(false)
    expect(isVersion('<b>R1</b>')).toBe(false)
    expect(isVersion(undefined)).toBe(false)
  })
  it('only a different real version counts as newer', () => {
    expect(isNewerBuild('R11.26.004', 'R11.26.005')).toBe(true)
    expect(isNewerBuild('R11.26.004', 'R11.26.004')).toBe(false)
    expect(isNewerBuild('R11.26.004', 'junk')).toBe(false)
    expect(isNewerBuild('dev', 'R11.26.004')).toBe(false)
  })
  it('a failed or odd version.json is ignored', async () => {
    expect(await fetchPublishedVersion(answering('R11.26.005'))).toBe('R11.26.005')
    expect(await fetchPublishedVersion(answering('R11.26.005', false))).toBeNull()
    expect(await fetchPublishedVersion(answering({ x: 1 }))).toBeNull()
    expect(await fetchPublishedVersion((async () => { throw new Error('offline') }) as unknown as typeof fetch)).toBeNull()
  })
})

describe('UpdateBanner', () => {
  it('shows nothing while the page is current', async () => {
    vi.useFakeTimers()
    render(<UpdateBanner running="R11.26.004" fetcher={answering('R11.26.004')} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100) })
    expect(screen.queryByText(/new version/i)).toBeNull()
  })

  it('appears when a newer version is published, and never reloads by itself', async () => {
    vi.useFakeTimers()
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true })
    render(<UpdateBanner running="R11.26.004" fetcher={answering('R11.26.005')} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100) })
    expect(screen.getByText(/new version of tipwave is ready/i)).toBeTruthy()
    expect(reload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /update now/i }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('can be dismissed', async () => {
    vi.useFakeTimers()
    render(<UpdateBanner running="R11.26.004" fetcher={answering('R11.26.005')} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100) })
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/new version/i)).toBeNull()
  })

  it('does nothing on a local run that has no version', async () => {
    vi.useFakeTimers()
    const fetcher = answering('R11.26.005')
    render(<UpdateBanner running="dev" fetcher={fetcher} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60 * 1000) })
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('VersionLabel', () => {
  it('shows a TEST pill only for test versions', () => {
    const { rerender } = render(<VersionLabel version="T11.26.017" />)
    expect(screen.getByText('T11.26.017')).toBeTruthy()
    expect(screen.getByText('Test')).toBeTruthy()
    rerender(<VersionLabel version="R11.26.004" />)
    expect(screen.getByText('R11.26.004')).toBeTruthy()
    expect(screen.queryByText('Test')).toBeNull()
  })
})
