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
  default: ({ isOpen, onClose }: any) => (isOpen ? <div role="dialog" aria-label="card sheet"><button onClick={onClose}>Not now</button></div> : null)
}))

import TippingInterface from '@/pages/TippingInterface'

const device = { id: 'd1', uuid: 'dev-1', ownerFirstName: 'Dave', ownerLastName: 'L', stageName: 'Dave', isStripeVerified: true, isKycVerified: true, tipAmounts: [2, 5, 10, 20, 50, 100], isAllowSongRequest: false, songCount: 0 }
const REASON = 'Your card has insufficient funds. Use a different payment method to complete this purchase.'

let tipReply: { status: number; body: unknown } = { status: 200, body: { id: 't1', status: 'pending', amount: 5 } }

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => new Proxy({}, { get: () => () => {}, set: () => true })) as any
  HTMLMediaElement.prototype.play = vi.fn(async () => {}) as any
  tipReply = { status: 400, body: { error: REASON, code: 'payment_failed' } }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'POST' && /\/api\/tips\/?$/.test(u)) {
      return { ok: tipReply.status < 400, status: tipReply.status, json: async () => tipReply.body, text: async () => JSON.stringify(tipReply.body), headers: new Headers() } as any
    }
    const body = u.includes('/public')
      ? device
      : u.includes('check-payment-methods') ? { hasPaymentMethods: true, cardBrand: 'visa', cardLast4: '4242' }
      : u.includes('user-total') ? { totalAmount: 0 } : u.includes('refund-notices') ? { notices: [], totalAmount: 0 } : {}
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() } as any
  }))
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }), configurable: true })
  localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
})

const tapFive = async () => {
  render(
    <MemoryRouter initialEntries={['/tip/dev-1']}>
      <Routes>
        <Route path="/tip/:deviceId" element={<TippingInterface />} />
      </Routes>
    </MemoryRouter>
  )
  await screen.findByRole('button', { name: 'Tip $2' })
  fireEvent.click(await screen.findByRole('button', { name: 'Tip $5' }))
}

describe('a tip refused at payment', () => {
  it('shows the reason in a message that stays until dismissed, saying the tipper was not charged', async () => {
    await tapFive()

    expect(await screen.findByText(REASON)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: "That tip didn't go through" })).toBeInTheDocument()
    expect(screen.getByText(/You were not charged/)).toBeInTheDocument()
    // it does not fade away like a toast
    await new Promise(r => setTimeout(r, 6000))
    expect(screen.getByText(REASON)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByText(REASON)).toBeNull())
  }, 20000)

  it('"Use a different card" closes the message and opens the card sheet', async () => {
    await tapFive()
    fireEvent.click(await screen.findByRole('button', { name: 'Use a different card' }))

    await waitFor(() => expect(screen.queryByText(REASON)).toBeNull())
    expect(await screen.findByRole('dialog', { name: 'card sheet' })).toBeInTheDocument()
  })

  it('any other error stays a quick toast, with no dialog', async () => {
    tipReply = { status: 400, body: { error: 'Failed to submit tip' } }
    await tapFive()

    // the tip request was made and refused; the toast host lives in App, so only the absence of the dialog is checked here
    await waitFor(() => expect((fetch as any).mock.calls.some(([u, i]: any) => /\/api\/tips\/?$/.test(String(u)) && i?.method === 'POST')).toBe(true))
    await new Promise(r => setTimeout(r, 300))
    expect(screen.queryByRole('dialog', { name: "That tip didn't go through" })).toBeNull()
    expect(screen.queryByText('Failed to submit tip')).toBeNull()
  })
})
