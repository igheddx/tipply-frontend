import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TipsTimeline } from '@/components/charts/TipsTimeline'

// jsdom has no layout, so the chart library is replaced by plain boxes; what matters here is the text around the chart
vi.mock('recharts', () => {
  const Box = ({ children }: any) => <div>{children}</div>
  return { Bar: Box, BarChart: Box, CartesianGrid: Box, ResponsiveContainer: Box, Scatter: Box, ScatterChart: Box, Tooltip: Box, XAxis: Box, YAxis: Box }
})

const minutesAgo = (m: number) => Date.now() - m * 60000
const points = (n: number) => Array.from({ length: n }, (_, i) => ({ time: '', amount: 10, timestamp: minutesAgo(i + 1) }))

beforeEach(() => {
  ;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

describe('TipsTimeline', () => {
  it('says when the chart holds only the newest tips of a busier account', () => {
    render(<TipsTimeline points={points(2000)} totalTips={3500} />)
    expect(screen.getByRole('note')).toHaveTextContent('This chart uses the newest 2,000 of 3,500 tips. Older tips are not included.')
  })

  it('says nothing when every tip is in the chart', () => {
    render(<TipsTimeline points={points(40)} totalTips={40} />)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('says nothing when the total is not known', () => {
    render(<TipsTimeline points={points(40)} />)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('counts the tips in the window it shows', () => {
    render(<TipsTimeline points={points(25)} totalTips={25} />)
    expect(screen.getAllByText('25').length).toBeGreaterThan(0) // the Tips figure for the last 3 hours (it also appears in the table)
  })
})
