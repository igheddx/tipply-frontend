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

// The card sheet is Stripe's world. Here it is a stand-in that shows what the page told it and can "save a card".
vi.mock('@/components/PaymentSetupModal', () => ({
  default: ({ isOpen, tipAmount, onClose, onComplete }: any) =>
    isOpen ? (
      <div role="dialog" aria-label="card sheet">
        <p>{tipAmount ? `held tip: $${tipAmount}` : 'no held tip'}</p>
        <button onClick={() => onComplete('pm_test_1')}>stand-in: save card</button>
        <button onClick={() => { onComplete('pm_test_1'); onComplete('pm_test_1') }}>stand-in: save card twice</button>
        <button onClick={onClose}>Not now</button>
      </div>
    ) : null
}))

import TippingInterface from '@/pages/TippingInterface'

const device = { id: 'd1', uuid: 'dev-1', ownerFirstName: 'Dave', ownerLastName: 'L', stageName: 'Dave', isStripeVerified: true, isKycVerified: true, tipAmounts: [2, 5, 10, 20, 50, 100], isAllowSongRequest: false, songCount: 0 }

let hasCard = false
let tipRequests: unknown[] = []

beforeEach(() => {
  // The celebration draws confetti and plays a sound; the test browser has neither
  HTMLCanvasElement.prototype.getContext = vi.fn(() => new Proxy({}, { get: () => () => {}, set: () => true })) as any
  HTMLMediaElement.prototype.play = vi.fn(async () => {}) as any
  hasCard = false
  tipRequests = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'POST' && /\/api\/tips\/?$/.test(u)) {
      tipRequests.push(JSON.parse(String(init?.body ?? '{}')))
      const b = { id: 't1', status: 'pending', amount: 5 }
      return { ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b), headers: new Headers() } as any
    }
    const body = u.includes('/public')
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

const tapFive = async () => fireEvent.click(await screen.findByRole('button', { name: 'Tip $5' }))

describe('a first-time tipper', () => {
  it('sees the real tip page first, with an invitation to add a card, and no card sheet yet', async () => {
    open()
    await screen.findByRole('button', { name: 'Tip $5' })
    expect(await screen.findByText(/No card yet/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'card sheet' })).toBeNull()
  })

  it('tapping an amount opens the card sheet with that amount held, and sends nothing', async () => {
    open()
    await tapFive()
    expect(await screen.findByText('held tip: $5')).toBeInTheDocument()
    expect(tipRequests).toHaveLength(0)
  })

  it('"Not now" sends nothing and forgets the amount', async () => {
    open()
    await tapFive()
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('dialog', { name: 'card sheet' })).toBeNull()
    fireEvent.click(await screen.findByText('Add one'))
    expect(await screen.findByText('no held tip')).toBeInTheDocument()
    expect(tipRequests).toHaveLength(0)
  })

  it('the moment the card is saved, the tip they chose is sent, once, for that amount', async () => {
    open()
    await tapFive()
    fireEvent.click(await screen.findByRole('button', { name: 'stand-in: save card' }))
    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(tipRequests[0]).toMatchObject({ amount: 5, deviceId: 'dev-1' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'card sheet' })).toBeNull())
    // nothing more is sent on its own
    await new Promise(r => setTimeout(r, 200))
    expect(tipRequests).toHaveLength(1)
  })

  it('a repeated "saved" message can never send the tip twice', async () => {
    open()
    await tapFive()
    fireEvent.click(await screen.findByRole('button', { name: 'stand-in: save card twice' }))
    await waitFor(() => expect(tipRequests).toHaveLength(1))
    await new Promise(r => setTimeout(r, 300))
    expect(tipRequests).toHaveLength(1)
  })

  it('saving a card from "Add one", with no tip chosen, sends nothing', async () => {
    open()
    fireEvent.click(await screen.findByText('Add one'))
    expect(await screen.findByText('no held tip')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'stand-in: save card' }))
    await new Promise(r => setTimeout(r, 200))
    expect(tipRequests).toHaveLength(0)
  })
})

describe('a tipper who already has a card', () => {
  it('sends the tip at once, with no card sheet', async () => {
    hasCard = true
    open()
    await tapFive()
    await waitFor(() => expect(tipRequests).toHaveLength(1))
    expect(screen.queryByRole('dialog', { name: 'card sheet' })).toBeNull()
  })
})
