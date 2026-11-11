import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const toastMock = vi.hoisted(() => ({ message: vi.fn(), error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toastMock, Toaster: () => null }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: async () => null }))
vi.mock('@stripe/react-stripe-js', () => ({ Elements: ({ children }: any) => <div>{children}</div>, useStripe: () => null, useElements: () => null, CardElement: () => null, PaymentElement: () => null }))
vi.mock('@/components/PaymentSetupModal', () => ({
  default: ({ isOpen }: any) => (isOpen ? <div role="dialog" aria-label="card sheet" /> : null)
}))

import TippingInterface from '@/pages/TippingInterface'

const device = { id: 'd1', uuid: 'dev-1', ownerFirstName: 'Dave', ownerLastName: 'L', stageName: 'Dave', isStripeVerified: false, isKycVerified: false, tipAmounts: [5, 10, 15, 20, 50, 100], isAllowSongRequest: false, songCount: 0 }

let calls: { method: string; url: string; body?: any }[] = []
let testResponse: any = { status: 'sent', lightSent: true, songRequested: false }

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => new Proxy({}, { get: () => () => {}, set: () => true })) as any
  HTMLMediaElement.prototype.play = vi.fn(async () => {}) as any
  calls = []
  toastMock.message.mockClear(); toastMock.error.mockClear()
  testResponse = { status: 'sent', lightSent: true, songRequested: false }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    const method = (init?.method ?? 'GET').toUpperCase()
    calls.push({ method, url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const body = u.includes('/api/admin/test-tip') ? testResponse : u.includes('/public') ? device : {}
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
    <MemoryRouter initialEntries={['/admin/test-tip/d1']}>
      <Routes>
        <Route path="/admin/test-tip/:deviceId" element={<TippingInterface testMode />} />
      </Routes>
    </MemoryRouter>
  )

// The banner is only on the loaded page (the loading screen has none), so waiting for it means the device has loaded
const loaded = () => screen.findByText(/TEST · nothing is charged or saved/)

const testCalls = () => calls.filter(c => c.url.includes('/api/admin/test-tip'))

describe('the admin test of a performer\'s tip page', () => {
  it('shows the performer\'s own amounts under a TEST banner', async () => {
    open()
    const banner = await loaded()
    expect(banner).toHaveTextContent(/TEST/)
    expect(screen.getByRole('button', { name: 'Tip $15' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tip $100' })).toBeInTheDocument()
  })

  it('works even when the performer is not yet set up to be paid, and never asks for a card', async () => {
    open()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Tip $20' }))
    await waitFor(() => expect(testCalls()).toHaveLength(1))
    expect(screen.queryByRole('dialog', { name: 'card sheet' })).toBeNull()
    expect(screen.queryByText(/No card yet/)).toBeNull()
    expect(screen.queryByText(/not set up to receive tips/)).toBeNull()
  })

  it('a tap sends one test tip for that device and amount, and nothing else: no tip, no card check, no totals', async () => {
    open()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Tip $50' }))
    await waitFor(() => expect(testCalls()).toHaveLength(1))

    expect(testCalls()[0]).toMatchObject({ method: 'POST', body: { deviceId: 'd1', amount: 50 } })
    expect(calls.filter(c => c.method === 'POST' && /\/api\/tips\/?$/.test(c.url))).toHaveLength(0)
    expect(calls.some(c => c.url.includes('check-payment-methods'))).toBe(false)
    expect(calls.some(c => c.url.includes('user-total'))).toBe(false)
  })

  it('every amount sends its own amount, so the light follows the performer\'s own settings', async () => {
    open()
    await loaded()
    for (const amount of [5, 100]) {
      fireEvent.click(screen.getByRole('button', { name: `Tip $${amount}` }))
      await waitFor(() => expect(testCalls().some(c => c.body.amount === amount)).toBe(true))
      await new Promise(r => setTimeout(r, 250)) // past the short double-tap guard
    }
  })

  it('tells the admin when the device is paused, so a silent tap is not a mystery', async () => {
    testResponse = { status: 'paused', lightSent: false, songRequested: false, message: 'This device is paused, so no light or sound was sent' }
    open()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Tip $10' }))
    await waitFor(() => expect(toastMock.message).toHaveBeenCalledWith(expect.stringMatching(/This device is paused/)))
  })
})
