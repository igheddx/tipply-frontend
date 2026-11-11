import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TipAmountsEditor from '../../components/TipAmountsEditor'

const setup = (amounts = [5, 10, 15, 20, 50, 100]) => {
  const onSave = vi.fn()
  render(<TipAmountsEditor amounts={amounts} saving={false} onSave={onSave} onReset={vi.fn()} />)
  return onSave
}

describe('TipAmountsEditor', () => {
  it('shows the sixteen amounts with the performer\'s six selected', () => {
    setup()
    expect(screen.getAllByRole('button', { pressed: true }).map(b => b.textContent)).toEqual(['$5', '$10', '$15', '$20', '$50', '$100'])
    expect(screen.getByText(/6 of 6 picked/)).toBeInTheDocument()
    expect(screen.getByText('$2')).toBeInTheDocument()
    expect(screen.getByText('$90')).toBeInTheDocument()
  })

  it('cannot save until exactly six are picked, and unchanged is not saveable', () => {
    setup()
    expect(screen.getByRole('button', { name: /Save amounts/ })).toBeDisabled()
    fireEvent.click(screen.getByText('$100'))
    expect(screen.getByText(/5 of 6 picked/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save amounts/ })).toBeDisabled()
  })

  it('does not allow a seventh amount', () => {
    setup()
    expect(screen.getByRole('button', { name: '$2' })).toBeDisabled()
  })

  it('saves the new six smallest to largest, whatever order they were picked in', () => {
    const onSave = setup()
    fireEvent.click(screen.getByText('$100'))
    fireEvent.click(screen.getByText('$2'))
    fireEvent.click(screen.getByRole('button', { name: /Save amounts/ }))
    expect(onSave).toHaveBeenCalledWith([2, 5, 10, 15, 20, 50])
  })

  it('keeps an amount chosen before the list was limited so it can be swapped out', () => {
    const onSave = setup([3, 10, 15, 20, 50, 100])
    expect(screen.getByRole('button', { name: '$3', pressed: true })).toBeInTheDocument()
    fireEvent.click(screen.getByText('$3'))
    fireEvent.click(screen.getByText('$5'))
    fireEvent.click(screen.getByRole('button', { name: /Save amounts/ }))
    expect(onSave).toHaveBeenCalledWith([5, 10, 15, 20, 50, 100])
  })
})
