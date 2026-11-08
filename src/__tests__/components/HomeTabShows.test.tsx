import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { HomeTab, type HomeData } from '@/components/portal/HomeTab'

vi.mock('recharts', () => ({
  Bar: () => null, BarChart: ({ children }: any) => <div>{children}</div>, CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>, Tooltip: () => null, XAxis: () => null, YAxis: () => null
}))

const data: HomeData = {
  firstName: 'Dave', today: { amount: 20, count: 2 }, month: { amount: 500, count: 30, trendPercent: 0, trendDirection: 'up' },
  pendingTips: 0, failedTips: 0, failedTipsCount: 0, scheduledPayouts: 0, inTransit: 0, available: 0, lifetime: 900, balancesLoading: false,
  devices: { active: 1, paused: 0, offline: 0, total: 1 }, weeks: [], nextSteps: []
}
const props = { data, formatCurrency: (n: number) => `$${n.toFixed(2)}`, onGoToDevices: () => {}, onGoToTips: () => {} }

describe('HomeTab with shows', () => {
  it('keeps the calendar-day tile when shows are off', () => {
    render(<HomeTab {...props} />)
    expect(screen.getAllByText('Tips today').length).toBeGreaterThan(0)
  })

  it('puts the show card in place of the calendar-day tile when shows are on', () => {
    render(<HomeTab {...props} showSlot={<div>This show card</div>} />)
    expect(screen.getByText('This show card')).toBeInTheDocument()
    expect(screen.queryByText('Tips today')).toBeNull()
    expect(screen.getAllByText('Tips this month').length).toBeGreaterThan(0)
  })
})
