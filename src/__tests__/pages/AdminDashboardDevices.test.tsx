import React from 'react'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminDashboard from '@/pages/AdminDashboard'

// Admin, Performers, Devices: delete a device on a performer's behalf. The screen must only say it worked when the server said so.
const { mockNavigate, api } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  api: { getProfile: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn() }
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))
vi.mock('@/components/PerformerInsights', () => ({ default: () => null }))
vi.mock('@/components/AggregatedChargesTable', () => ({ default: () => null }))
vi.mock('@/components/RecoverChargedTips', () => ({ default: () => null }))
vi.mock('@/components/ClearFailedTestTips', () => ({ default: () => null }))
vi.mock('@/components/MarkDemoTips', () => ({ default: () => null }))
vi.mock('@/components/venue/AdminVenues', () => ({ AdminVenues: () => null }))
vi.mock('@/components/feedback/AdminFeedback', () => ({ AdminFeedback: () => null }))
vi.mock('@/components/health/AdminApiHealth', () => ({ AdminApiHealth: () => null }))
vi.mock('@/components/repeat/AdminRepeat', () => ({ AdminRepeat: () => null }))
vi.mock('@/components/refunds/AdminRefunds', () => ({ AdminRefunds: () => null }))

vi.setConfig({ testTimeout: 120000 })
const realGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = ((element: Element) => realGetComputedStyle(element)) as typeof window.getComputedStyle

const dave = {
  id: 'p1', firstName: 'Dave', lastName: 'Lovett', stageName: 'Dave Lovett Piano', email: 'dave@example.com',
  devices: [{ id: 'd1', serialNumber: 'TPW-1', nickname: 'Piano', createdAt: '2026-11-01T00:00:00Z' }]
}

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  localStorage.getItem = vi.fn((k: string) => (k === 'token' ? 'test-token' : null))
  api.getProfile.mockResolvedValue({ data: { role: 'root_admin' } })
  api.get.mockImplementation(async (url: string) => {
    if (url.includes('/api/admin/performers/search-devices')) return { data: [dave] }
    return { data: url.includes('/api/admin/performers') ? [] : null }
  })
  api.post.mockResolvedValue({ data: { message: 'ok' } })
})

const startDelete = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Delete', hidden: true }))
  expect(await screen.findByText('Delete this device?')).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: 'Delete device', hidden: true }))
}

describe('admin device delete', () => {
  // one render of the big admin page for both cases: rendering it is most of the time
  it('does not say it worked when the server refused, and does when the server says it worked', async () => {
    render(<AdminDashboard />)
    const nav = (await screen.findAllByRole('navigation', { name: 'Main' }))[0]
    fireEvent.click(within(nav).getByRole('button', { name: /Performers/ }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Devices' }))
    const search = await screen.findByPlaceholderText('Search performers or devices...')
    fireEvent.change(search, { target: { value: 'dave' } })
    fireEvent.keyDown(search, { key: 'Enter', code: 'Enter', keyCode: 13 })

    // refused: the question closes once the request has finished, and no success message may have appeared
    api.post.mockResolvedValue({ error: 'Device not found for performer', status: 404 })
    await startDelete()
    await waitFor(() => expect(screen.queryByText('Delete this device?')).toBeNull())
    expect(api.post).toHaveBeenCalledWith('/api/admin/performers/p1/devices/d1/delete', expect.objectContaining({ sendEmail: expect.any(Boolean) }))
    expect(screen.queryByText('Device deleted successfully')).toBeNull()

    // worked: the server says so, and so does the screen
    api.post.mockResolvedValue({ data: { message: 'Device deleted successfully' } })
    await startDelete()
    expect(await screen.findByText('Device deleted successfully')).toBeInTheDocument()
  })
})
