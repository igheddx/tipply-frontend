import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AdminApiHealth } from '@/components/health/AdminApiHealth'
import type { ApiHealthData } from '@/services/apiHealthApi'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/services/apiHealthApi', async () => {
  const actual: any = await vi.importActual('@/services/apiHealthApi')
  return { ...actual, apiHealthApi: { get: api.get } }
})

const okWindows = [
  { key: '1h', label: 'Last hour', status: 'ok', requests: 1000, serverErrors: 2, errorRatePercent: 0.2, p95LatencyMs: 180.4 },
  { key: '24h', label: 'Last 24 hours', status: 'ok', requests: 20000, serverErrors: 30, errorRatePercent: 0.15, p95LatencyMs: 310.2 }
]

const data = (over: Partial<ApiHealthData> = {}): ApiHealthData => ({
  state: 'ok', environment: 'Test', message: '', stale: false, readsEnabled: true, latencyTargetMs: null, cacheSeconds: 300, attemptsToday: 1, attemptsPerDay: 5,
  snapshot: { fetchedAtUtc: '2026-11-10T15:07:00Z', windows: okWindows as any }, ...over
})

const show = (d: ApiHealthData) => {
  api.get.mockResolvedValue({ data: d })
  return render(<AdminApiHealth />)
}

describe('API Health page', () => {
  beforeEach(() => api.get.mockReset())

  it('says which environment it is reading, in words', async () => {
    show(data({ environment: 'Test' }))
    expect(await screen.findByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Reading the')).toBeInTheDocument()
  })

  it('labels Production as Production', async () => {
    show(data({ environment: 'Production' }))
    expect(await screen.findByText('Production')).toBeInTheDocument()
    expect(screen.queryByText('Test')).toBeNull()
  })

  it('shows requests, server errors, the 5xx rate and p95 for both windows', async () => {
    show(data())
    await screen.findByText('Last hour')
    expect(screen.getByText('Last 24 hours')).toBeInTheDocument()
    expect(screen.getAllByText('Requests')).toHaveLength(2)
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getByText('20,000')).toBeInTheDocument()
    expect(screen.getByText('0.2%')).toBeInTheDocument()
    expect(screen.getByText('180 ms')).toBeInTheDocument()
    expect(screen.getByText('310 ms')).toBeInTheDocument()
  })

  it('says the internal target is not set until it is configured, and does not claim a result without one', async () => {
    show(data({ latencyTargetMs: null }))
    await screen.findByText('Last hour')
    expect(screen.getAllByText(/Internal latency target: not set yet/)).toHaveLength(2)
    expect(screen.queryByText(/Within internal target/)).toBeNull()
    expect(screen.queryByText(/Above internal target/)).toBeNull()
  })

  it('compares p95 with the configured internal target, and calls it an internal target', async () => {
    show(data({ latencyTargetMs: 250 }))
    await screen.findByText('Last hour')
    expect(screen.getByText('Within internal target')).toBeInTheDocument() // 180 ms
    expect(screen.getByText('Above internal target')).toBeInTheDocument() // 310 ms
    expect(screen.getAllByText(/Internal target \(not a customer promise\)/)).toHaveLength(2)
  })

  it('shows No traffic for a confirmed zero, and nothing is shown as healthy numbers', async () => {
    show(data({ snapshot: { fetchedAtUtc: '2026-11-10T15:07:00Z', windows: [{ key: '1h', label: 'Last hour', status: 'no_traffic', requests: 0 }, okWindows[1]] as any } }))
    expect(await screen.findByText('No traffic')).toBeInTheDocument()
    expect(screen.queryByText('Data unavailable')).toBeNull()
  })

  it('shows Data unavailable when a window has no usable data, which is not the same as No traffic', async () => {
    show(data({ snapshot: { fetchedAtUtc: '2026-11-10T15:07:00Z', windows: [{ key: '1h', label: 'Last hour', status: 'unavailable' }, okWindows[1]] as any } }))
    expect(await screen.findByText('Data unavailable')).toBeInTheDocument()
    expect(screen.queryByText('No traffic')).toBeNull()
    expect(screen.queryByText('0%')).toBeNull()
  })

  it('shows "Monitoring not configured" with no numbers and no environment', async () => {
    show({ state: 'not_configured', environment: null, message: 'Monitoring not configured', stale: false, readsEnabled: false, cacheSeconds: 300, attemptsPerDay: 5 })
    expect(await screen.findByText('Monitoring not configured')).toBeInTheDocument()
    expect(screen.getByText('Environment not set')).toBeInTheDocument()
    expect(screen.queryByText('Requests')).toBeNull()
    expect(screen.queryByText('Last hour')).toBeNull()
  })

  it('says reads are switched off for that environment, and marks any saved reading as stale', async () => {
    show(data({ state: 'disabled', message: 'AWS reads are switched off for Test.', readsEnabled: false, stale: true }))
    expect(await screen.findByText('Metric reads are switched off for Test')).toBeInTheDocument()
    expect(screen.getByText('Stale')).toBeInTheDocument()
    expect(screen.getAllByText('Last saved reading')).toHaveLength(2)
  })

  it('switched off with nothing saved shows no numbers at all', async () => {
    show(data({ state: 'disabled', message: 'AWS reads are switched off for Production.', environment: 'Production', readsEnabled: false, snapshot: null }))
    expect(await screen.findByText('Metric reads are switched off for Production')).toBeInTheDocument()
    expect(screen.queryByText('Requests')).toBeNull()
  })

  it('shows Data unavailable with the reason, and the last good reading marked stale, when a fresh read was not possible', async () => {
    show(data({ state: 'unavailable', message: "Today's limit of 5 metric reads for Test has been reached. It resets at midnight UTC.", stale: true }))
    expect(await screen.findByText('Data unavailable')).toBeInTheDocument()
    expect(screen.getByText(/limit of 5 metric reads/)).toBeInTheDocument()
    expect(screen.getByText('Stale')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
  })

  it('a request that fails shows Data unavailable and never a healthy page', async () => {
    api.get.mockResolvedValue({ error: 'Network error' })
    render(<AdminApiHealth />)
    expect(await screen.findByText('Data unavailable')).toBeInTheDocument()
    expect(screen.getByText(/does not mean the API is healthy/)).toBeInTheDocument()
    expect(screen.queryByText('Requests')).toBeNull()
  })

  it('shows when it last refreshed, how often it can, and how many reads are used today', async () => {
    show(data({ attemptsToday: 3 }))
    await screen.findByText('Last hour')
    expect(screen.getByText(/Last refreshed/)).toBeInTheDocument()
    expect(screen.getByText(/at most every 5 minutes/)).toBeInTheDocument()
    expect(screen.getByText(/3 of 5 metric reads used today for Test/)).toBeInTheDocument()
  })

  it('Refresh asks the server again and sends nothing that picks an environment or a time range', async () => {
    show(data())
    await screen.findByText('Last hour')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh API health' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    for (const call of api.get.mock.calls) expect(call).toHaveLength(0)
  })

  it('says it is not an uptime check', async () => {
    show(data())
    expect(await screen.findByText(/This is not an uptime check/)).toBeInTheDocument()
  })
})
