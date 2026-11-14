import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { HomeTab, type HomeData } from '@/components/portal/HomeTab'

vi.mock('recharts', () => ({
  Bar: () => null, BarChart: ({ children }: any) => <div>{children}</div>, CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>, Tooltip: () => null, XAxis: () => null, YAxis: () => null
}))

const base: HomeData = {
  firstName: 'Dave', today: { amount: 20, count: 2 }, month: { amount: 500, count: 30, trendPercent: 0, trendDirection: 'up' },
  pendingTips: 35, failedTips: 0, failedTipsCount: 0, scheduledPayouts: 487.22, inTransit: 90.94, available: 120, lifetime: 1199, balancesLoading: false,
  devices: { active: 1, paused: 0, offline: 0, total: 1 }, weeks: [], nextSteps: []
}
const props = (data: Partial<HomeData> = {}) => ({ data: { ...base, ...data }, formatCurrency: (n: number) => `$${n.toFixed(2)}`, onGoToDevices: () => {}, onGoToTips: () => {} })

// the money card is the section whose heading is "Where your money is"
const moneyRows = () => {
  const heading = screen.getByText('Where your money is')
  const section = heading.closest('section') ?? heading.parentElement!.parentElement!
  return within(section as HTMLElement).getAllByRole('listitem').map(r => r.textContent ?? '')
}

describe('HomeTab, where your money is', () => {
  it('shows the three stages of the money in the order it moves', () => {
    render(<HomeTab {...props()} />)
    const rows = moneyRows()

    expect(rows[0]).toContain('Coming from Stripe')
    expect(rows[0]).toContain('$487.22')
    expect(rows[1]).toContain('Ready to pay out')
    expect(rows[1]).toContain('$120.00')
    expect(rows[2]).toContain('On its way to your bank')
    expect(rows[2]).toContain('$90.94')
  })

  it('keeps the rarely needed numbers behind "More details", closed to start with', () => {
    render(<HomeTab {...props()} />)

    expect(screen.queryByText('Tips waiting to be charged')).toBeNull()
    expect(screen.queryByText('All-time tips')).toBeNull()
    expect(screen.getByRole('button', { name: 'More details' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows them when asked, and hides them again', () => {
    render(<HomeTab {...props()} />)

    fireEvent.click(screen.getByRole('button', { name: 'More details' }))
    expect(screen.getByText('Tips waiting to be charged')).toBeInTheDocument()
    expect(screen.getByText('$35.00')).toBeInTheDocument()
    expect(screen.getByText('All-time tips')).toBeInTheDocument()
    expect(screen.getByText('$1199.00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fewer details' }))
    expect(screen.queryByText('All-time tips')).toBeNull()
  })

  it('shows dots, not zeros, while Stripe is still being asked', () => {
    render(<HomeTab {...props({ balancesLoading: true })} />)
    const rows = moneyRows()

    expect(rows[0]).toContain('…')
    expect(rows[0]).not.toContain('$487.22')
    expect(screen.getByText('Updating from Stripe…')).toBeInTheDocument()
  })

  it('offers an alerts slot on Home when one is given, and the Live button for everyone', () => {
    render(<HomeTab {...props()} alertsSlot={<div>alerts offer</div>} onGoToLive={() => {}} />)
    expect(screen.getByText('alerts offer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Live' })).toBeInTheDocument()
  })
})
