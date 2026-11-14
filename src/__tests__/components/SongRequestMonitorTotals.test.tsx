import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SongRequestMonitor from '@/components/SongRequestMonitor'

const api = vi.hoisted(() => ({ current: vi.fn(), list: vi.fn() }))
vi.mock('@/services/showApi', () => ({ showApi: api }))
vi.mock('@/utils/config', () => ({ API_BASE_URL: 'http://localhost:3000' }))
vi.mock('@/components/venue/SessionBanner', () => ({ SessionBanner: () => null }))
vi.mock('@/utils/tipChime', () => ({ playTipChime: vi.fn(() => true), unlockTipChime: vi.fn(async () => true), isTipChimeReady: vi.fn(() => true) }))
vi.mock('@/theme/ThemeContext', () => ({ usePortalTheme: () => ({ dark: false, className: '' }), useTheme: () => ({ setPreference: vi.fn() }) }))

class FakeIntersectionObserver { observe() {} unobserve() {} disconnect() {} }

beforeEach(() => {
  ;(globalThis as any).IntersectionObserver = FakeIntersectionObserver
  localStorage.clear()
  api.current.mockReset().mockResolvedValue({ data: { id: 's1', name: null, venueName: null, startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), isLive: true, tipCount: 12, gross: 260, waitingGross: 0, fees: 20, youKeep: 240, refundedCount: 0, refundedGross: 0 } })
  api.list.mockReset().mockResolvedValue({ data: { shows: [], total: 0, page: 1, pageSize: 20 } })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ songRequests: [], tipsWithoutSong: [] }), text: async () => '' }) as any
})

describe('Live shows the night total', () => {
  it("on a performer's own screen: what they keep and how many tips, without leaving Live", async () => {
    render(<SongRequestMonitor profileId="p1" isVisible onClose={() => undefined} />)

    expect(await screen.findByLabelText('You keep $240.00')).toBeInTheDocument()
    expect(screen.getByText('12 tips')).toBeInTheDocument()
  })

  it("not on an admin's view-only screen, which would show the admin's own show", async () => {
    render(<SongRequestMonitor profileId="p1" isVisible readOnly onClose={() => undefined} />)
    await new Promise(r => setTimeout(r, 150))

    expect(screen.queryByRole('region', { name: 'Show totals' })).toBeNull()
    expect(api.current).not.toHaveBeenCalled()
  })
})
