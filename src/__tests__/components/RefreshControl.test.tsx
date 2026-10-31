import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { RefreshControl } from '../../components/ui'

describe('RefreshControl', () => {
  it('calls refresh when pressed', () => {
    const onRefresh = vi.fn()
    render(<RefreshControl onRefresh={onRefresh} busy={false} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('cannot be pressed again while a refresh is running', () => {
    const onRefresh = vi.fn()
    render(<RefreshControl onRefresh={onRefresh} busy />)
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('shows when the page was last updated', () => {
    render(<RefreshControl onRefresh={() => {}} busy={false} updatedAt={new Date(2026, 9, 31, 22, 42)} />)
    expect(screen.getByText(/updated 10:42/i)).toBeInTheDocument()
  })
})
