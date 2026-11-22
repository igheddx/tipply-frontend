import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ShowPlatformMix } from '@/components/platform/ShowPlatformMix'

const api = vi.hoisted(() => ({ show: vi.fn(), admin: vi.fn() }))
vi.mock('@/services/platformMixApi', () => ({ platformMixApi: api }))

const row = (key: string, over: Record<string, number> = {}) => ({
  key, tippers: 0, tips: 0, totalAmount: 0, walletTippers: 0, walletTips: 0, walletAmount: 0, songRequesters: 0, songRequests: 0, ...over
})
const way = (tippers: number, tips: number, totalAmount: number) => ({ tippers, tips, totalAmount })

const showMix = (ios: number, android: number) => ({
  data: {
    days: 0,
    tippers: ios + android,
    rows: [row('ios', { tippers: ios, tips: ios * 2, totalAmount: ios * 20 }), row('android', { tippers: android, tips: android, totalAmount: android * 10 }), row('desktop'), row('unknown')],
    wallet: way(ios, ios * 2, ios * 20),
    card: way(android, android, android * 10),
    estimatedTips: 0,
    walletReach: { known: 0, available: 0, usedWallet: 0, typedCardInstead: 0 }
  }
})

const toggle = () => screen.getByRole('button', { name: /Phones and how they pay/ })

describe('ShowPlatformMix', () => {
  beforeEach(() => {
    api.show.mockReset()
    api.admin.mockReset()
  })

  it('is closed at first and asks the server for nothing, so the show page is exactly as quick as before', () => {
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(api.show).not.toHaveBeenCalled()
    expect(screen.queryByTestId('phones-ios')).toBeNull()
  })

  it('reads the show once when it is opened and shows the same breakdown as the platform card', async () => {
    api.show.mockResolvedValue(showMix(6, 4))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    fireEvent.click(toggle())

    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByTestId('phones-ios')).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(1)
    expect(api.show).toHaveBeenCalledWith('p1', 's1')
    expect(within(screen.getByTestId('phones-ios')).getByText('60%')).toBeInTheDocument() // 6 of 10
    expect(within(screen.getByTestId('pay-wallet')).getByText('75%')).toBeInTheDocument() // 12 of 16 tips
    expect(screen.getByText(/Showing 10 tippers in this show\./)).toBeInTheDocument()
  })

  it('does not read it again when it is closed and opened', async () => {
    api.show.mockResolvedValue(showMix(3, 1))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    fireEvent.click(toggle())
    await screen.findByTestId('phones-ios')
    fireEvent.click(toggle()) // close
    expect(screen.queryByTestId('phones-ios')).toBeNull()
    fireEvent.click(toggle()) // open again
    expect(await screen.findByTestId('phones-ios')).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(1)
  })

  it('reads the newly chosen show when the admin switches shows while it is open, and not the old one again', async () => {
    api.show.mockImplementation(async (_p: string, showId: string) => (showId === 's1' ? showMix(6, 4) : showMix(1, 1)))
    const { rerender } = render(<ShowPlatformMix profileId="p1" showId="s1" />)
    fireEvent.click(toggle())
    expect(await screen.findByText(/Showing 10 tippers/)).toBeInTheDocument()

    rerender(<ShowPlatformMix profileId="p1" showId="s2" />)
    expect(await screen.findByText(/Showing 2 tippers/)).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(2)

    rerender(<ShowPlatformMix profileId="p1" showId="s1" />) // back to the first: already read
    expect(await screen.findByText(/Showing 10 tippers/)).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(2)
  })

  it('stays closed when the show changes, and reads the new show only when it is opened', async () => {
    api.show.mockResolvedValue(showMix(2, 2))
    const { rerender } = render(<ShowPlatformMix profileId="p1" showId="s1" />)

    rerender(<ShowPlatformMix profileId="p1" showId="s2" />)
    expect(api.show).not.toHaveBeenCalled()

    fireEvent.click(toggle())
    await screen.findByTestId('phones-ios')
    expect(api.show).toHaveBeenCalledTimes(1)
    expect(api.show).toHaveBeenCalledWith('p1', 's2')
  })

  it('says so when nobody tipped in the show', async () => {
    api.show.mockResolvedValue(showMix(0, 0))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)
    fireEvent.click(toggle())

    expect(await screen.findByText('Nobody tipped in this show.')).toBeInTheDocument()
    expect(screen.queryByText('NaN%')).toBeNull()
  })

  it('shows a calm message when it cannot be loaded, and tries again when it is closed and reopened', async () => {
    api.show.mockResolvedValueOnce({ error: 'Not allowed', status: 403 }).mockResolvedValue(showMix(2, 2))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    fireEvent.click(toggle())
    expect(await screen.findByText(/numbers could not be loaded/)).toBeInTheDocument()

    fireEvent.click(toggle()) // close
    fireEvent.click(toggle()) // open again: a new try
    expect(await screen.findByTestId('phones-ios')).toBeInTheDocument()
    expect(api.show).toHaveBeenCalledTimes(2)
  })

  it('shows a placeholder while the numbers load', async () => {
    let resolve: (v: unknown) => void = () => {}
    api.show.mockReturnValue(new Promise(r => { resolve = r }))
    render(<ShowPlatformMix profileId="p1" showId="s1" />)

    fireEvent.click(toggle())
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    resolve(showMix(1, 1))
    await waitFor(() => expect(screen.getByTestId('phones-ios')).toBeInTheDocument())
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })
})
