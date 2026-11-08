import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RepeatCard } from '@/components/repeat/RepeatCard'
import { AdminRepeat } from '@/components/repeat/AdminRepeat'

const api = vi.hoisted(() => ({ mine: vi.fn(), admin: vi.fn(), adminPerformers: vi.fn() }))
vi.mock('@/services/repeatApi', () => ({ repeatApi: api }))
vi.mock('recharts', () => ({
  Bar: () => null, BarChart: ({ children }: any) => <div>{children}</div>, CartesianGrid: () => null, Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>, Tooltip: () => null, XAxis: () => null, YAxis: () => null
}))

const stats = (over: Record<string, unknown> = {}) => ({
  tippers: 10, returningTippers: 4, multiTipTippers: 6, regulars: 1, activeTippers: 7, activeReturningTippers: 3,
  totalTipAmount: 500, returningTipAmount: 300, medianDaysToReturn: 6.5,
  cohorts: [{ days: 7, eligible: 8, returned: 2 }, { days: 30, eligible: 5, returned: 2 }, { days: 90, eligible: 0, returned: 0 }],
  weekly: [{ weekStart: '2026-11-02T00:00:00Z', newTippers: 3, returningTippers: 1 }], ...over
})

beforeEach(() => Object.values(api).forEach(f => f.mockReset()))

describe('RepeatCard (performer home screen)', () => {
  it('shows the share who came back, the windows, regulars and the money share, with the honest note', async () => {
    api.mine.mockResolvedValue({ data: stats() })
    render(<RepeatCard />)

    expect(await screen.findByTestId('repeat-rate')).toHaveTextContent('40%')
    expect(screen.getByText(/4 of 10 tippers tipped on more than one night/)).toBeInTheDocument()
    expect(screen.getByText('25% (2 of 8)')).toBeInTheDocument()
    expect(screen.getByText('40% (2 of 5)')).toBeInTheDocument()
    expect(screen.getByText(/Regulars \(three nights or more\)/)).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText(/at least this high/)).toBeInTheDocument()
  })

  it('is warm and quiet before anyone has tipped', async () => {
    api.mine.mockResolvedValue({ data: stats({ tippers: 0, returningTippers: 0, cohorts: [] }) })
    render(<RepeatCard />)
    expect(await screen.findByText(/appear here once people start tipping you/)).toBeInTheDocument()
    expect(screen.queryByTestId('repeat-rate')).toBeNull()
  })

  it('does not blame the performer when nobody has come back yet', async () => {
    api.mine.mockResolvedValue({ data: stats({ tippers: 3, returningTippers: 0, regulars: 0, multiTipTippers: 0, totalTipAmount: 30, returningTipAmount: 0, medianDaysToReturn: null, cohorts: [] }) })
    render(<RepeatCard />)
    expect(await screen.findByTestId('repeat-rate')).toHaveTextContent('0%')
    expect(screen.getByText(/takes a few shows for regulars/)).toBeInTheDocument()
    expect(screen.queryByText(/Back within/)).toBeNull()
  })

  it('shows nothing at all if the numbers cannot be loaded', async () => {
    api.mine.mockResolvedValue({ error: 'nope' })
    const { container } = render(<RepeatCard />)
    await screen.findByText('', {}, { timeout: 50 }).catch(() => {})
    expect(container.textContent).not.toMatch(/regulars/i)
  })
})

describe('AdminRepeat (platform overview)', () => {
  it('shows the headline, all three windows (saying too early when it is), and the other repeat measures', async () => {
    api.admin.mockResolvedValue({ data: stats() })
    render(<AdminRepeat />)

    expect(await screen.findByTestId('admin-repeat-rate')).toHaveTextContent('40%')
    expect(screen.getByText(/Back within 7 days/)).toBeInTheDocument()
    expect(screen.getByText('25% (2 of 8)')).toBeInTheDocument()
    expect(screen.getByText('too early to tell')).toBeInTheDocument() // 90 days: nobody is old enough yet
    expect(screen.getByText(/Active in the last 30 days/)).toBeInTheDocument()
    expect(screen.getByText(/Tipped more than once \(any night\)/)).toBeInTheDocument()
    expect(screen.getByText('New and returning tippers by week')).toBeInTheDocument()
  })

  it('says there is nothing to measure yet when no one has tipped', async () => {
    api.admin.mockResolvedValue({ data: stats({ tippers: 0, returningTippers: 0 }) })
    render(<AdminRepeat />)
    expect(await screen.findByText('Nothing to measure yet.')).toBeInTheDocument()
  })
})
