import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/utils/deviceId', async () => {
  const actual: any = await vi.importActual('@/utils/deviceId')
  return { ...actual, initDeviceId: async () => 'visitor-1' }
})
vi.mock('@stripe/stripe-js', () => ({ loadStripe: async () => null }))
vi.mock('@stripe/react-stripe-js', () => ({ Elements: ({ children }: any) => <div>{children}</div>, useStripe: () => null, useElements: () => null, CardElement: () => null, PaymentElement: () => null }))
vi.mock('@/components/PaymentSetupModal', () => ({
  default: ({ isOpen, onComplete }: any) =>
    isOpen ? (
      <div role="dialog" aria-label="card sheet">
        <button onClick={() => onComplete('pm_test_1')}>stand-in: save card</button>
      </div>
    ) : null
}))

import TippingInterface from '@/pages/TippingInterface'

const baseDevice = { id: 'd1', uuid: 'dev-1', ownerFirstName: 'Dave', ownerLastName: 'L', stageName: 'Dave', isStripeVerified: true, isKycVerified: true, tipAmounts: [5, 10, 15, 20, 50, 100], isAllowSongRequest: true, songCount: 3, askForSongFirst: true }
const catalog = [
  { id: 's1', songTitle: 'Brown Eyed Girl', artist: 'Van Morrison' },
  { id: 's2', songTitle: 'Piano Man', artist: 'Billy Joel' }
]

let device: any = baseDevice
let hasCard = true
let tipRequests: any[] = []

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => new Proxy({}, { get: () => () => {}, set: () => true })) as any
  HTMLMediaElement.prototype.play = vi.fn(async () => {}) as any
  device = { ...baseDevice }
  hasCard = true
  tipRequests = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'POST' && /\/api\/tips\/?$/.test(u)) {
      tipRequests.push(JSON.parse(String(init?.body ?? '{}')))
      const b = { id: 't1', status: 'pending', amount: 20 }
      return { ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b), headers: new Headers() } as any
    }
    const body = u.includes('/api/songcatalog/performer/')
      ? catalog
      : u.includes('/public')
        ? device
        : u.includes('check-payment-methods')
          ? hasCard ? { hasPaymentMethods: true, cardBrand: 'visa', cardLast4: '4242' } : { hasPaymentMethods: false }
          : u.includes('user-total') ? { totalAmount: 0 } : u.includes('refund-notices') ? { notices: [], totalAmount: 0 } : {}
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() } as any
  }))
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }), configurable: true })
  localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', configurable: true })
})

const open = () =>
  render(
    <MemoryRouter initialEntries={['/tip/dev-1']}>
      <Routes>
        <Route path="/tip/:deviceId" element={<TippingInterface />} />
      </Routes>
    </MemoryRouter>
  )

// The heading carries the performer's name only once the device has loaded, so wait for it before tapping
const loaded = async () => {
  await screen.findByText('Tip Dave')
  await new Promise(r => setTimeout(r, 50))
}
const tap = async (amount: number) => {
  fireEvent.click(await screen.findByRole('button', { name: `Tip $${amount}` }))
}
const quiet = () => new Promise(r => setTimeout(r, 250))

describe('the song question when an amount is tapped (a performer who asks first)', () => {
  it('asks about a song, and sends nothing yet', async () => {
    open()
    await loaded()
    await tap(20)

    expect(await screen.findByText('Request a song with your $20 tip?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No thanks, just tip $20' })).toBeInTheDocument()
    await quiet()
    expect(tipRequests).toHaveLength(0)
  })

  it('"No thanks, just tip" sends the tip once, with no song', async () => {
    open()
    await loaded()
    await tap(20)
    fireEvent.click(await screen.findByRole('button', { name: 'No thanks, just tip $20' }))

    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(tipRequests[0]).toMatchObject({ amount: 20, deviceId: 'dev-1' })
    expect(tipRequests[0].songId).toBeUndefined()
    await quiet()
    expect(tipRequests).toHaveLength(1)
    await waitFor(() => expect(screen.queryByText('Request a song with your $20 tip?')).toBeNull()) // the sheet slides away
  })

  it('picking a song sends the tip and the song together, for the amount that was tapped', async () => {
    open()
    await loaded()
    await tap(50)
    fireEvent.click(await screen.findByText('Piano Man'))
    fireEvent.click(await screen.findByRole('button', { name: 'Send $50 tip with this song' }))

    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(tipRequests[0]).toMatchObject({ amount: 50, songId: 's2' })
    await quiet()
    expect(tipRequests).toHaveLength(1)
  })

  it('closing the question without answering sends nothing, and the next tap asks again', async () => {
    open()
    await loaded()
    await tap(10)
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('Request a song with your $10 tip?')).toBeNull())
    expect(tipRequests).toHaveLength(0)

    await tap(15)
    expect(await screen.findByText('Request a song with your $15 tip?')).toBeInTheDocument()
  })

  it('asks every time an amount is tapped without a chosen song', async () => {
    open()
    await loaded()
    await tap(20)
    fireEvent.click(await screen.findByRole('button', { name: 'No thanks, just tip $20' }))
    await waitFor(() => expect(tipRequests).toHaveLength(1))
    await new Promise(r => setTimeout(r, 300)) // past the double-tap guard

    await tap(20)
    expect(await screen.findByText('Request a song with your $20 tip?')).toBeInTheDocument()
  })

  it('does not ask when a song was already chosen with the "Request a song" button', async () => {
    open()
    await loaded()
    fireEvent.click(await screen.findByText('Request a song'))
    fireEvent.click(await screen.findByText('Brown Eyed Girl'))
    fireEvent.click(await screen.findByRole('button', { name: 'Choose a tip amount' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pick a song' })).toBeNull())

    await tap(20)

    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(tipRequests[0]).toMatchObject({ amount: 20, songId: 's1' })
    expect(screen.queryByText('Request a song with your $20 tip?')).toBeNull()
  })

  it('never asks a first-time tipper twice: the question, then the card, then one tip', async () => {
    hasCard = false
    open()
    await loaded()
    await tap(20)
    fireEvent.click(await screen.findByRole('button', { name: 'No thanks, just tip $20' }))
    fireEvent.click(await screen.findByRole('button', { name: 'stand-in: save card' }))

    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(tipRequests[0]).toMatchObject({ amount: 20 })
    await waitFor(() => expect(screen.queryByText('Request a song with your $20 tip?')).toBeNull()) // not asked again after the card
    await quiet()
    expect(tipRequests).toHaveLength(1)
  })

  it('a first-time tipper who picks a song: the card is asked for, then the tip goes with the song', async () => {
    hasCard = false
    open()
    await loaded()
    await tap(10)
    fireEvent.click(await screen.findByText('Piano Man'))
    fireEvent.click(await screen.findByRole('button', { name: 'Send $10 tip with this song' }))
    expect(tipRequests).toHaveLength(0) // nothing is sent until there is a card
    fireEvent.click(await screen.findByRole('button', { name: 'stand-in: save card' }))

    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(tipRequests[0]).toMatchObject({ amount: 10, songId: 's2' })
  })
})

describe('when the question does not apply', () => {
  it('a performer who has not turned it on: one tap sends the tip, exactly as before', async () => {
    device = { ...baseDevice, askForSongFirst: false }
    open()
    await loaded()
    await tap(20)

    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(screen.queryByText(/Request a song with your/)).toBeNull()
  })

  it('does not ask when the performer does not take song requests', async () => {
    device = { ...baseDevice, isAllowSongRequest: false }
    open()
    await loaded()
    await tap(20)

    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(screen.queryByText(/Request a song with your/)).toBeNull()
  })

  it('does not ask when there are no songs to pick from', async () => {
    device = { ...baseDevice, songCount: 0 }
    open()
    await loaded()
    await tap(20)

    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(screen.queryByText(/Request a song with your/)).toBeNull()
  })
})
