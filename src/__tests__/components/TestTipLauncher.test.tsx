import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TestTipLauncher, { testTipPath, watchLivePath } from '../../components/TestTipLauncher'

describe('TestTipLauncher', () => {
  it('has one button when the performer has one device, and launches that device', () => {
    const onLaunch = vi.fn()
    render(<TestTipLauncher performerName="Dave" devices={[{ id: 'd1', nickname: 'Tip Jah' }]} onLaunch={onLaunch} />)
    fireEvent.click(screen.getByRole('button', { name: /Launch test tip page/ }))
    expect(onLaunch).toHaveBeenCalledWith('d1')
  })

  it('has a button for each device, named, when there are several', () => {
    const onLaunch = vi.fn()
    render(<TestTipLauncher performerName="Dave" devices={[{ id: 'd1', nickname: 'Stage' }, { id: 'd2', serialNumber: 'SN9' }]} onLaunch={onLaunch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Launch test: Stage' }))
    fireEvent.click(screen.getByRole('button', { name: 'Launch test: Device SN9' }))
    expect(onLaunch.mock.calls).toEqual([['d1'], ['d2']])
  })

  it('leaves out deleted devices, and says so when there is nothing to test', () => {
    render(<TestTipLauncher performerName="Dave" devices={[{ id: 'd1', nickname: 'Old', isDeleted: true }]} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/no active device/)).toBeInTheDocument()
  })

  it('explains that nothing is charged or saved', () => {
    render(<TestTipLauncher performerName="Dave" devices={[{ id: 'd1' }]} onLaunch={() => {}} />)
    expect(screen.getByText(/Nothing is charged and nothing is saved/)).toBeInTheDocument()
  })

  it('points at the admin-only page for that device', () => {
    expect(testTipPath('abc')).toBe('/admin/test-tip/abc')
  })

  it('has a button to watch the performer\'s Live screen, which opens it for that performer', () => {
    const onWatch = vi.fn()
    render(<TestTipLauncher performerName="Dave" performerId="perf-1" devices={[{ id: 'd1' }]} onLaunch={() => {}} onWatch={onWatch} />)
    fireEvent.click(screen.getByRole('button', { name: /Watch Dave's Live screen/ }))
    expect(onWatch).toHaveBeenCalledWith('perf-1', 'Dave')
    expect(screen.getByText(/no buttons that change anything/)).toBeInTheDocument()
  })

  it('offers watching even when the performer has no device, since the Live screen does not need one', () => {
    render(<TestTipLauncher performerName="Dave" performerId="perf-1" devices={[]} onWatch={() => {}} />)
    expect(screen.getByRole('button', { name: /Watch Dave's Live screen/ })).toBeInTheDocument()
    expect(screen.getByText(/no active device/)).toBeInTheDocument()
  })

  it('has no watch button when the performer is unknown', () => {
    render(<TestTipLauncher performerName="Dave" devices={[{ id: 'd1' }]} onLaunch={() => {}} />)
    expect(screen.queryByRole('button', { name: /Live screen/ })).toBeNull()
  })

  it('the watch link carries the id, and the name only as a safely encoded label', () => {
    expect(watchLivePath('abc', 'Dave L & Co')).toBe('/admin/watch-live/abc?n=Dave%20L%20%26%20Co')
  })
})
