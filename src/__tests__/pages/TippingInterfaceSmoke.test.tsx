import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/utils/deviceId', async () => {
  const actual: any = await vi.importActual('@/utils/deviceId')
  return { ...actual, initDeviceId: async () => 'visitor-1' }
})
vi.mock('@stripe/stripe-js', () => ({ loadStripe: async () => null }))
vi.mock('@stripe/react-stripe-js', () => ({ Elements: ({ children }: any) => <div>{children}</div>, useStripe: () => null, useElements: () => null, CardElement: () => null, PaymentElement: () => null }))

import TippingInterface from '@/pages/TippingInterface'

const device = { id: 'd1', uuid: 'dev-1', ownerFirstName: 'Dave', ownerLastName: 'L', stageName: 'Dave', isStripeVerified: true, isKycVerified: true, tipAmounts: [2, 5, 10, 20, 50, 100], isAllowSongRequest: true, songCount: 3 }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url)
    const body = u.includes('/public') ? device : u.includes('payment') || u.includes('has-payment') ? { hasPaymentMethods: true, cardBrand: 'visa', cardLast4: '4242' } : u.includes('user-total') ? { totalAmount: 0 } : u.includes('refund-notices') ? { notices: [], totalAmount: 0 } : {}
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() } as any
  }))
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }), configurable: true })
  localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', configurable: true })
})

describe('TippingInterface mounts', () => {
  it('shows the tip screen on a phone with a saved card, without crashing', async () => {
    const errors: any[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a) })
    render(
      <MemoryRouter initialEntries={['/tip/dev-1']}>
        <Routes>
          <Route path="/tip/:deviceId" element={<TippingInterface />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(document.body.textContent?.length).toBeGreaterThan(5), { timeout: 3000 })
    // Wait for the real tip screen (not the loading or desktop message)
    await waitFor(() => expect(document.body.textContent).toContain('Request a song'), { timeout: 4000 })
    spy.mockRestore()
    const fatal = errors.find(e => /The above error occurred|Error: Uncaught|is not a function|Cannot read/.test(String(e[0]) + String(e[1] ?? '')))
    expect(fatal).toBeUndefined()
  })
})
