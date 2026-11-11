import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TestTipLauncher, { testTipPath } from '../../components/TestTipLauncher'

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
})
