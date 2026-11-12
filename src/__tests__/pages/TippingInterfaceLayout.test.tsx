import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@stripe/stripe-js', () => ({ loadStripe: async () => null }))
vi.mock('@stripe/react-stripe-js', () => ({ Elements: ({ children }: any) => <div>{children}</div>, useStripe: () => null, useElements: () => null, CardElement: () => null, PaymentElement: () => null }))
vi.mock('@/components/PaymentSetupModal', () => ({ default: () => null }))

import TippingInterface from '@/pages/TippingInterface'

const device = { id: 'd1', uuid: 'dev-1', ownerFirstName: 'Dave', ownerLastName: 'L', stageName: 'Dave', isStripeVerified: true, isKycVerified: true, tipAmounts: [5, 10, 15, 20, 50, 100], isAllowSongRequest: false, songCount: 0 }

const setScreen = (width: number, height: number, portraitMatches: boolean) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: portraitMatches, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
    configurable: true
  })
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => new Proxy({}, { get: () => () => {}, set: () => true })) as any
  HTMLMediaElement.prototype.play = vi.fn(async () => {}) as any
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url)
    const body = u.includes('/public') ? device : u.includes('check-payment-methods') ? { hasPaymentMethods: true, cardBrand: 'visa', cardLast4: '4242' } : u.includes('user-total') ? { totalAmount: 0 } : {}
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() } as any
  }))
  localStorage.clear()
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

describe('the tip page layout', () => {
  it('a phone turned sideways gets a plain screen asking to turn it upright, and no tip page behind it', async () => {
    setScreen(844, 390, false) // a phone in landscape
    open()

    expect(await screen.findByText('Portrait mode only')).toBeInTheDocument()
    expect(screen.getByText(/turn your phone upright/i)).toBeInTheDocument()
    await new Promise(r => setTimeout(r, 200))
    expect(screen.queryByRole('button', { name: 'Tip $5' })).toBeNull()
    expect(screen.queryByText('Tip Dave')).toBeNull()
  })

  it('upright, the tip page shows in a phone-width column even in a wide window', async () => {
    setScreen(390, 844, true)
    const { container } = open()

    await screen.findByRole('button', { name: 'Tip $5' })
    await waitFor(() => expect(container.querySelector('.max-w-\\[480px\\]')).not.toBeNull())
    expect(screen.queryByText('Portrait mode only')).toBeNull()
  })

  it('a wide desktop window is not treated as a turned phone: it is asked to open the page on a phone', async () => {
    setScreen(1440, 900, false)
    open()

    expect(await screen.findByText('Open this on your phone')).toBeInTheDocument()
    expect(screen.queryByText('Portrait mode only')).toBeNull()
  })
})
