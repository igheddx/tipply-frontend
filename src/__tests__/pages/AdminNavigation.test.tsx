import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminDashboard from '@/pages/AdminDashboard'

const { mockNavigate, api } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  api: { getProfile: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn() }
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))
vi.mock('@/components/PerformerInsights', () => ({ default: () => <div>insights body</div> }))

vi.setConfig({ testTimeout: 60000 })
const realGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = ((element: Element) => realGetComputedStyle(element)) as typeof window.getComputedStyle

const open = async (role: string) => {
  api.getProfile.mockResolvedValue({ data: { role } })
  render(<AdminDashboard />)
  return (await screen.findAllByRole('navigation', { name: 'Main' }))[0]
}

describe('admin navigation', () => {
  beforeEach(() => {
    Object.values(api).forEach(f => f.mockReset())
    localStorage.getItem = vi.fn((k: string) => (k === 'token' ? 'test-token' : null))
    api.get.mockImplementation(async (url: string) => ({ data: url.includes('/api/admin/performers') ? [] : null }))
    api.post.mockResolvedValue({ data: null })
  })

  it('groups the menu as People, Money and System, with no separate Insights or Devices entry', async () => {
    const nav = await open('root_admin')
    for (const group of ['People', 'Money', 'System']) expect(within(nav).getByText(group)).toBeInTheDocument()
    expect(within(nav).queryByText('Learn')).toBeNull()
    expect(within(nav).queryByRole('button', { name: /Insights/ })).toBeNull()
    expect(within(nav).queryByRole('button', { name: /^Devices/ })).toBeNull()
    expect(within(nav).getByRole('button', { name: /Performers/ })).toBeInTheDocument()
  })

  it('reaches Insights and Devices from the Performers page', async () => {
    const nav = await open('root_admin')
    fireEvent.click(within(nav).getByRole('button', { name: /Performers/ }))

    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map(t => t.textContent)).toEqual(['All performers', 'Insights', 'Devices'])
    fireEvent.click(screen.getByRole('tab', { name: 'Insights' }))
    expect(await screen.findByText('insights body')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Insights' })).toHaveAttribute('aria-selected', 'true')
  })

  it('sends anyone who is not a root admin back to their own dashboard', async () => {
    api.getProfile.mockResolvedValue({ data: { role: 'user' } })
    render(<AdminDashboard />)
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  })
})
