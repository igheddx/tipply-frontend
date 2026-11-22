import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AdminPlatformMix } from '@/components/platform/AdminPlatformMix'

const api = vi.hoisted(() => ({ admin: vi.fn() }))
vi.mock('@/services/platformMixApi', () => ({ platformMixApi: api }))

const row = (key: string, over: Record<string, number> = {}) => ({
  key, tippers: 0, tips: 0, totalAmount: 0, walletTippers: 0, walletTips: 0, walletAmount: 0, songRequesters: 0, songRequests: 0, ...over
})

const way = (tippers: number, tips: number, totalAmount: number) => ({ tippers, tips, totalAmount })

const mix = (rows: ReturnType<typeof row>[], days = 30, wallet = way(0, 0, 0), card = way(0, 0, 0)) => ({
  data: { days, tippers: rows.reduce((n, r) => n + r.tippers, 0), rows, wallet, card }
})

// 100 tippers, 170 tips. Wallet: 110 tips ($1,100) from 51 tippers. Card: 60 tips ($530) from 49 tippers.
const sample = () =>
  mix(
    [
      row('ios', { tippers: 60, tips: 120, totalAmount: 1200, walletTippers: 45, walletTips: 100, walletAmount: 1000, songRequesters: 15, songRequests: 20 }),
      row('android', { tippers: 30, tips: 40, totalAmount: 300, walletTippers: 6, walletTips: 10, walletAmount: 100, songRequesters: 3, songRequests: 3 }),
      row('desktop', { tippers: 4, tips: 4, totalAmount: 40 }),
      row('unknown', { tippers: 6, tips: 6, totalAmount: 90 })
    ],
    30,
    way(51, 110, 1100),
    way(49, 60, 530)
  )

describe('AdminPlatformMix', () => {
  beforeEach(() => {
    api.admin.mockReset()
  })

  it('shows iPhone, Android and Other side by side as shares of everyone who tipped', async () => {
    api.admin.mockResolvedValue(sample())
    render(<AdminPlatformMix />)

    const ios = await screen.findByTestId('phones-ios')
    expect(within(ios).getByText('60%')).toBeInTheDocument()
    expect(within(ios).getByText('60 tippers')).toBeInTheDocument()
    const android = screen.getByTestId('phones-android')
    expect(within(android).getByText('30%')).toBeInTheDocument()
    // Other is a computer plus the phones that were never recorded: 4 + 6
    const other = screen.getByTestId('phones-other')
    expect(within(other).getByText('10%')).toBeInTheDocument()
    expect(within(other).getByText('10 tippers')).toBeInTheDocument()
  })

  it('has a row for each of the four kinds with tips, totals, averages, wallet use and song requests', async () => {
    api.admin.mockResolvedValue(sample())
    render(<AdminPlatformMix />)

    const ios = await screen.findByTestId('phones-row-ios')
    expect(within(ios).getByText('iPhone / iPad')).toBeInTheDocument()
    expect(within(ios).getByText('$1,200.00')).toBeInTheDocument()
    expect(within(ios).getByText('$10.00')).toBeInTheDocument() // average tip: 1200 / 120
    expect(within(ios).getByText('83%')).toBeInTheDocument() // 100 of 120 tips came from wallet payers
    expect(within(ios).getByText('45 of 60 tippers')).toBeInTheDocument()
    expect(within(ios).getByText('15 (25%)')).toBeInTheDocument() // asked for a song
    expect(within(ios).getByText('20 requests')).toBeInTheDocument()

    const android = screen.getByTestId('phones-row-android')
    expect(within(android).getByText('$7.50')).toBeInTheDocument() // 300 / 40
    expect(within(android).getByText('3 requests')).toBeInTheDocument()
    expect(screen.getByTestId('phones-row-desktop')).toHaveTextContent('Computer')
    expect(screen.getByTestId('phones-row-unknown')).toHaveTextContent('Not recorded')
  })

  it('shows what share of tips came from Apple or Google Pay and what share from a typed-in card', async () => {
    api.admin.mockResolvedValue(sample())
    render(<AdminPlatformMix />)

    const box = await screen.findByTestId('how-they-pay')
    const wallet = within(box).getByTestId('pay-wallet')
    expect(within(wallet).getByText('65%')).toBeInTheDocument() // 110 of 170 tips
    expect(within(wallet).getByText('Apple / Google Pay')).toBeInTheDocument()
    expect(within(wallet).getByText('110 tips · 51 tippers · $1,100.00')).toBeInTheDocument()
    const card = within(box).getByTestId('pay-card')
    expect(within(card).getByText('35%')).toBeInTheDocument() // 60 of 170 tips
    expect(within(card).getByText('Card typed in')).toBeInTheDocument()
    expect(within(card).getByText('60 tips · 49 tippers · $530.00')).toBeInTheDocument()
    expect(within(box).getByText(/not how each tip was paid/)).toBeInTheDocument() // says plainly how it is counted
  })

  it('shows the Android share of tips from wallet payers in its own row', async () => {
    api.admin.mockResolvedValue(sample())
    render(<AdminPlatformMix />)

    const android = await screen.findByTestId('phones-row-android')
    expect(within(android).getByText('25%')).toBeInTheDocument() // 10 of 40 tips
    expect(within(android).getByText('6 of 30 tippers')).toBeInTheDocument()
  })

  it('leaves the payment block out, without breaking, when the server does not send it', async () => {
    api.admin.mockResolvedValue({ data: { days: 30, tippers: 5, rows: [row('ios', { tippers: 5, tips: 5, totalAmount: 50 }), row('android'), row('desktop'), row('unknown')] } })
    render(<AdminPlatformMix />)

    expect(await screen.findByTestId('phones-ios')).toBeInTheDocument()
    expect(screen.queryByTestId('how-they-pay')).toBeNull()
  })

  it('shows all tips on one side when everyone pays the same way, never a divide by zero', async () => {
    api.admin.mockResolvedValue(mix([row('ios', { tippers: 2, tips: 3, totalAmount: 30 }), row('android'), row('desktop'), row('unknown')], 30, way(0, 0, 0), way(2, 3, 30)))
    render(<AdminPlatformMix />)

    const box = await screen.findByTestId('how-they-pay')
    expect(within(within(box).getByTestId('pay-card')).getByText('100%')).toBeInTheDocument()
    expect(within(within(box).getByTestId('pay-wallet')).getByText('0%')).toBeInTheDocument()
    expect(within(within(box).getByTestId('pay-wallet')).getByText('0 tips · 0 tippers · $0.00')).toBeInTheDocument()
    expect(screen.queryByText('NaN%')).toBeNull()
  })

  it('asks for 30 days first and reloads for the period the admin picks, including all time', async () => {
    api.admin.mockResolvedValue(sample())
    render(<AdminPlatformMix />)
    await screen.findByTestId('phones-ios')
    expect(api.admin).toHaveBeenLastCalledWith(30)
    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'All time' }))
    await waitFor(() => expect(api.admin).toHaveBeenLastCalledWith(0))
    expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    await waitFor(() => expect(api.admin).toHaveBeenLastCalledWith(7))
  })

  it('says so plainly when nobody tipped in the period, with no division by zero', async () => {
    api.admin.mockResolvedValue(mix([row('ios'), row('android'), row('desktop'), row('unknown')]))
    render(<AdminPlatformMix />)

    expect(await screen.findByText('Nobody has tipped in this period.')).toBeInTheDocument()
    expect(screen.queryByTestId('phones-ios')).toBeNull()
    expect(screen.queryByText('NaN%')).toBeNull()
  })

  it('shows a calm message, not a broken card, when the numbers cannot be loaded', async () => {
    api.admin.mockResolvedValue({ error: 'Not allowed', status: 403 })
    render(<AdminPlatformMix />)

    expect(await screen.findByText(/numbers could not be loaded/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '90 days' })).toBeInTheDocument() // the period buttons stay usable
  })

  it('copes with a kind missing from the reply by treating it as zero', async () => {
    api.admin.mockResolvedValue({ data: { days: 30, tippers: 5, rows: [row('ios', { tippers: 5, tips: 5, totalAmount: 50 })] } })
    render(<AdminPlatformMix />)

    expect(await screen.findByTestId('phones-row-android')).toHaveTextContent('Android')
    expect(within(screen.getByTestId('phones-android')).getByText('0%')).toBeInTheDocument()
  })

  it('uses the singular for one tipper and one request', async () => {
    api.admin.mockResolvedValue(mix([row('ios', { tippers: 1, tips: 1, totalAmount: 5, songRequesters: 1, songRequests: 1 }), row('android'), row('desktop'), row('unknown')]))
    render(<AdminPlatformMix />)

    const ios = await screen.findByTestId('phones-ios')
    expect(within(ios).getByText('1 tipper')).toBeInTheDocument()
    expect(within(screen.getByTestId('phones-row-ios')).getByText('1 request')).toBeInTheDocument()
  })
})
