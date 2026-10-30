import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { DemoBanner } from '@/components/portal/DemoBanner'

describe('DemoBanner', () => {
  it('shows nothing when demo mode is off', () => {
    const { container } = render(<DemoBanner demoMode={false} showDemo={false} onToggle={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says demo mode is on and offers the toggle, off by default', () => {
    render(<DemoBanner demoMode showDemo={false} onToggle={() => {}} />)
    expect(screen.getByText('Demo mode is on')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /show demo data/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('says when demo data is showing', () => {
    render(<DemoBanner demoMode showDemo onToggle={() => {}} />)
    expect(screen.getByText('Showing demo data')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /show demo data/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('calls back when the toggle is flipped', () => {
    const onToggle = vi.fn()
    render(<DemoBanner demoMode showDemo={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('switch', { name: /show demo data/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
